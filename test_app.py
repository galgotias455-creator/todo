import json
import tempfile
import unittest
from pathlib import Path

from app import create_app


class TodoApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / "test.sqlite3"
        self.app = create_app({"TESTING": True, "DATABASE": str(database)})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def add_task(self, title):
        return self.client.post(
            "/api/todos",
            data=json.dumps({"title": title}),
            content_type="application/json",
        )

    def test_create_edit_complete_filter_and_clear(self):
        created = self.add_task("Write a few tests")
        self.assertEqual(created.status_code, 201)
        todo = created.get_json()["todo"]
        self.assertEqual(todo["title"], "Write a few tests")
        self.assertFalse(todo["completed"])

        edited = self.client.patch(
            f"/api/todos/{todo['id']}",
            json={"title": "Write focused tests", "completed": True},
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.get_json()["todo"]["title"], "Write focused tests")
        self.assertTrue(edited.get_json()["todo"]["completed"])

        active = self.client.get("/api/todos?filter=active").get_json()
        self.assertEqual(active["todos"], [])
        self.assertEqual(active["counts"]["completed"], 1)

        cleared = self.client.delete("/api/todos/completed")
        self.assertEqual(cleared.get_json()["deleted"], 1)
        self.assertEqual(self.client.get("/api/todos").get_json()["counts"]["total"], 0)

    def test_task_validation_and_missing_task(self):
        self.assertEqual(self.add_task("   ").status_code, 400)
        self.assertEqual(self.add_task("x" * 201).status_code, 400)
        self.assertEqual(self.client.delete("/api/todos/999").status_code, 404)

    def test_todos_survive_app_restart(self):
        self.add_task("Keep this task")
        restarted = create_app({
            "TESTING": True,
            "DATABASE": self.app.config["DATABASE"],
        })
        result = restarted.test_client().get("/api/todos").get_json()
        self.assertEqual(result["todos"][0]["title"], "Keep this task")


if __name__ == "__main__":
    unittest.main()
