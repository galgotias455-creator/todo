const todoList = document.querySelector('#todo-list');
const addForm = document.querySelector('#add-form');
const taskInput = document.querySelector('#new-task');
const searchInput = document.querySelector('#search-input');
const toast = document.querySelector('#toast');
const filterLabels = { all: 'ALL TASKS', active: 'IN PROGRESS', completed: 'COMPLETED' };

let todos = [];
let currentFilter = 'all';
let searchTerm = '';
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function makeIcon(name) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    save: '<path d="m5 12 4 4L19 6"/>',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name];
  return svg;
}

function createAction(label, icon, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${className}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(makeIcon(icon));
  button.addEventListener('click', onClick);
  return button;
}

function createTodoItem(todo, index) {
  const item = document.createElement('li');
  item.className = `todo-item${todo.completed ? ' is-complete' : ''}`;
  item.style.animationDelay = `${Math.min(index, 8) * 25}ms`;

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'todo-check';
  check.setAttribute('aria-label', `${todo.completed ? 'Mark as active' : 'Complete'}: ${todo.title}`);
  check.setAttribute('aria-pressed', String(todo.completed));
  check.addEventListener('click', () => updateTodo(todo.id, { completed: !todo.completed }));

  const copy = document.createElement('div');
  copy.className = 'todo-copy';
  const title = document.createElement('span');
  title.className = 'todo-title';
  title.textContent = todo.title;
  const date = document.createElement('span');
  date.className = 'todo-date';
  date.textContent = `Added ${formatDate(todo.created_at)}`;
  copy.append(title, date);

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  actions.append(
    createAction('Edit task', 'edit', 'edit-button', () => beginEdit(item, todo)),
    createAction('Delete task', 'delete', 'delete-button', () => deleteTodo(todo.id)),
  );
  item.append(check, copy, actions);
  return item;
}

function beginEdit(item, todo) {
  const copy = item.querySelector('.todo-copy');
  const actions = item.querySelector('.row-actions');
  const input = document.createElement('input');
  input.className = 'edit-field';
  input.type = 'text';
  input.maxLength = 200;
  input.value = todo.title;
  input.setAttribute('aria-label', 'Edit task text');
  const hint = document.createElement('span');
  hint.className = 'edit-hint';
  hint.textContent = 'Enter to save · Esc to cancel';
  copy.replaceChildren(input, hint);
  actions.replaceChildren(
    createAction('Save task', 'save', 'save-button', () => saveEdit(todo.id, input)),
    createAction('Cancel editing', 'delete', 'cancel-button', () => render()),
  );
  input.focus();
  input.select();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveEdit(todo.id, input);
    if (event.key === 'Escape') render();
  });
}

async function saveEdit(id, input) {
  try {
    await api(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ title: input.value }) });
    await loadTodos();
    showToast('Task updated.');
  } catch (error) {
    showToast(error.message);
    input.focus();
  }
}

function render() {
  const filtered = todos.filter((todo) => {
    const matchesFilter = currentFilter === 'all'
      || (currentFilter === 'active' && !todo.completed)
      || (currentFilter === 'completed' && todo.completed);
    return matchesFilter && todo.title.toLocaleLowerCase().includes(searchTerm);
  });

  todoList.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    const mark = document.createElement('span');
    mark.className = 'empty-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = searchTerm ? '?' : currentFilter === 'completed' ? '✓' : '1';
    const heading = document.createElement('h2');
    heading.className = 'empty-title';
    const message = document.createElement('p');
    message.className = 'empty-copy';
    if (searchTerm) {
      heading.textContent = 'No matches just yet';
      message.textContent = 'Try another search or add this as a new task.';
    } else if (currentFilter === 'completed') {
      heading.textContent = 'Nothing completed yet';
      message.textContent = 'Finished tasks will find their way here.';
    } else if (currentFilter === 'active' && todos.length) {
      heading.textContent = 'All caught up';
      message.textContent = 'You have no tasks in progress.';
    } else {
      heading.textContent = 'Start with one thing';
      message.textContent = 'Add a task above and take it from there.';
    }
    empty.append(mark, heading, message);
    todoList.append(empty);
  } else {
    filtered.forEach((todo, index) => todoList.append(createTodoItem(todo, index)));
  }

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;
  document.querySelector('#total-count').textContent = todos.length;
  document.querySelector('#active-count').textContent = activeCount;
  document.querySelector('#completed-count').textContent = completedCount;
  document.querySelector('#all-tab-count').textContent = todos.length;
  document.querySelector('#progress-number').textContent = completedCount;
  document.querySelector('#summary').textContent = todos.length
    ? `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} in motion. Keep going at your own pace.`
    : 'A clear mind starts with a clear list.';
  document.querySelector('#current-view').textContent = filterLabels[currentFilter];
  document.querySelector('#list-title').textContent = filterLabels[currentFilter];
  document.querySelector('#list-counter').textContent = `${filtered.length} ${filtered.length === 1 ? 'ITEM' : 'ITEMS'}`;
  document.querySelector('#remaining-label').textContent = `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} left`;
  document.querySelector('#list-footer').hidden = todos.length === 0;
  document.querySelector('#clear-completed').disabled = completedCount === 0;
  document.querySelector('#clear-completed').setAttribute('aria-disabled', String(completedCount === 0));
  document.querySelector('#toggle-all').hidden = todos.length === 0;
  document.querySelector('#toggle-all').setAttribute('aria-label', activeCount ? 'Complete all tasks' : 'Mark all tasks active');
  document.querySelector('#toggle-all').title = activeCount ? 'Complete all tasks' : 'Mark all tasks active';
  document.querySelectorAll('[data-filter]').forEach((button) => {
    const selected = button.dataset.filter === currentFilter;
    if (button.classList.contains('filter-tab')) {
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    } else {
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
}

async function loadTodos() {
  todoList.setAttribute('aria-busy', 'true');
  try {
    const result = await api('/api/todos');
    todos = result.todos;
    render();
  } catch (error) {
    showToast(error.message);
    todoList.replaceChildren();
  } finally {
    todoList.setAttribute('aria-busy', 'false');
  }
}

async function updateTodo(id, changes) {
  try {
    await api(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    await loadTodos();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteTodo(id) {
  try {
    await api(`/api/todos/${id}`, { method: 'DELETE' });
    await loadTodos();
    showToast('Task deleted.');
  } catch (error) {
    showToast(error.message);
  }
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }
  try {
    await api('/api/todos', { method: 'POST', body: JSON.stringify({ title }) });
    taskInput.value = '';
    currentFilter = 'all';
    searchTerm = '';
    searchInput.value = '';
    await loadTodos();
    taskInput.focus();
    showToast('Task added.');
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLocaleLowerCase();
  render();
});

document.querySelector('#toggle-all').addEventListener('click', async () => {
  try {
    await api('/api/todos/toggle-all', { method: 'POST' });
    await loadTodos();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector('#clear-completed').addEventListener('click', async () => {
  try {
    const result = await api('/api/todos/completed', { method: 'DELETE' });
    await loadTodos();
    showToast(`${result.deleted} completed ${result.deleted === 1 ? 'task' : 'tasks'} cleared.`);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric',
}).format(new Date()).toUpperCase();

loadTodos();
