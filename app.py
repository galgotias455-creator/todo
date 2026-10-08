import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, g, jsonify, render_template, request


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE=os.environ.get(
            "TODO_DATABASE", str(Path(app.instance_path) / "todos.sqlite3")
        )
    )
    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    initialize_database(app)

    def get_db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"])
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA busy_timeout = 5000")
        return g.db

    @app.teardown_appcontext
    def close_db(_error=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/todos")
    def list_todos():
        selected_filter = request.args.get("filter", "all")
        if selected_filter not in {"all", "active", "completed"}:
            return jsonify(error="Unknown filter."), 400

        conditions = {
            "all": "",
            "active": "WHERE completed = 0",
            "completed": "WHERE completed = 1",
        }
        db = get_db()
        todos = db.execute(
            f"SELECT id, title, completed, created_at FROM todos "
            f"{conditions[selected_filter]} ORDER BY completed ASC, id DESC"
        ).fetchall()
        counts = db.execute(
            "SELECT COUNT(*) AS total, "
            "SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS active, "
            "SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed "
            "FROM todos"
        ).fetchone()
        return jsonify(
            todos=[serialize_todo(todo) for todo in todos],
            counts={key: counts[key] or 0 for key in ("total", "active", "completed")},
        )

    @app.post("/api/todos")
    def create_todo():
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not isinstance(data.get("title"), str):
            return jsonify(error="Enter a task to add."), 400
        title = data["title"].strip()
        if not title:
            return jsonify(error="A task can't be empty."), 400
        if len(title) > 200:
            return jsonify(error="Tasks must be 200 characters or fewer."), 400

        db = get_db()
        cursor = db.execute(
            "INSERT INTO todos (title, created_at) VALUES (?, ?)",
            (title, datetime.now(timezone.utc).isoformat()),
        )
        db.commit()
        todo = db.execute(
            "SELECT id, title, completed, created_at FROM todos WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return jsonify(todo=serialize_todo(todo)), 201

    @app.patch("/api/todos/<int:todo_id>")
    def update_todo(todo_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not data:
            return jsonify(error="No changes were provided."), 400

        updates = []
        values = []
        if "title" in data:
            if not isinstance(data["title"], str):
                return jsonify(error="Task text must be plain text."), 400
            title = data["title"].strip()
            if not title:
                return jsonify(error="A task can't be empty."), 400
            if len(title) > 200:
                return jsonify(error="Tasks must be 200 characters or fewer."), 400
            updates.append("title = ?")
            values.append(title)
        if "completed" in data:
            if not isinstance(data["completed"], bool):
                return jsonify(error="Completion must be true or false."), 400
            updates.append("completed = ?")
            values.append(int(data["completed"]))
        if not updates:
            return jsonify(error="No supported changes were provided."), 400

        db = get_db()
        values.append(todo_id)
        cursor = db.execute(
            f"UPDATE todos SET {', '.join(updates)} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            db.rollback()
            return jsonify(error="That task no longer exists."), 404
        db.commit()
        todo = db.execute(
            "SELECT id, title, completed, created_at FROM todos WHERE id = ?",
            (todo_id,),
        ).fetchone()
        return jsonify(todo=serialize_todo(todo))

    @app.delete("/api/todos/<int:todo_id>")
    def delete_todo(todo_id):
        db = get_db()
        cursor = db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        if cursor.rowcount == 0:
            db.rollback()
            return jsonify(error="That task no longer exists."), 404
        db.commit()
        return jsonify(ok=True)

    @app.post("/api/todos/toggle-all")
    def toggle_all():
        db = get_db()
        has_active = db.execute(
            "SELECT EXISTS(SELECT 1 FROM todos WHERE completed = 0)"
        ).fetchone()[0]
        db.execute("UPDATE todos SET completed = ?", (int(bool(has_active)),))
        db.commit()
        return jsonify(ok=True)

    @app.delete("/api/todos/completed")
    def clear_completed():
        db = get_db()
        cursor = db.execute("DELETE FROM todos WHERE completed = 1")
        db.commit()
        return jsonify(deleted=cursor.rowcount)

    return app


def initialize_database(app):
    database_path = Path(app.config["DATABASE"])
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database_path) as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS todos ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200), "
            "completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)), "
            "created_at TEXT NOT NULL)"
        )


def serialize_todo(todo):
    return {
        "id": todo["id"],
        "title": todo["title"],
        "completed": bool(todo["completed"]),
        "created_at": todo["created_at"],
    }


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
