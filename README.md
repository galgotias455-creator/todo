# Daymark Todo

A small, local-first Todo app built with Python, Flask, and SQLite. Tasks are saved in `instance/todos.sqlite3` and remain available after restarting the app.

## Features

- Add, edit, complete, and delete tasks
- Filter by all, active, or completed tasks
- Search tasks as you type
- Complete all tasks or clear completed tasks
- Task counts and completion progress
- Responsive layout and keyboard-friendly controls
- SQLite persistence with no separate database service

## Run locally

Python 3.9 or newer is required.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000. If PowerShell blocks environment activation, install dependencies using `.venv\Scripts\python.exe -m pip install -r requirements.txt`, then start the app with `.venv\Scripts\python.exe app.py`.

The database is created automatically. To choose another database location, set the `TODO_DATABASE` environment variable before starting the app.

## Run tests

```powershell
python -m unittest
```
