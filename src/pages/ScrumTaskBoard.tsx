import { useState } from "react";
import type { FormEvent } from "react";
import "./ScrumTaskBoard.css";

interface ScrumTask {
  id: string;
  title: string;
  status: "To Do" | "In Progress" | "Done";
  assignee: string;
}

const INITIAL_TASKS: ScrumTask[] = [
  {
    id: "SCRUM-240",
    title: "Xây dựng giao diện danh sách Lead",
    status: "Done",
    assignee: "HM",
  },
  {
    id: "SCRUM-241",
    title: "Xây dựng form tạo Lead",
    status: "Done",
    assignee: "HM",
  },
  {
    id: "SCRUM-242",
    title: "Xây dựng form cập nhật Lead",
    status: "Done",
    assignee: "HM",
  },
];

const ScrumTaskBoard = () => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [editingTask, setEditingTask] = useState<ScrumTask | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

  const updateTask = (taskId: string, updates: Partial<ScrumTask>) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task,
      ),
    );
  };

  const openEditor = (task: ScrumTask) => {
    setEditingTask(task);
    setEditedTitle(task.title);
  };

  const saveTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask || !editedTitle.trim()) return;
    updateTask(editingTask.id, { title: editedTitle.trim() });
    setEditingTask(null);
  };

  return (
    <div className="scrum-page">
      <header className="scrum-page-header">
        <div>
          <p className="scrum-eyebrow">SPRINT BOARD</p>
          <h1>Công việc Lead</h1>
        </div>
        <span className="scrum-task-total">{tasks.length} công việc</span>
      </header>

      <section className="scrum-task-list" aria-label="Danh sách công việc Lead">
        <div className="scrum-list-accent" />
        {tasks.length === 0 ? (
          <p className="scrum-empty">Chưa có công việc nào.</p>
        ) : (
          tasks.map((task) => (
            <article className="scrum-task-card" key={task.id}>
              <div className="scrum-task-card-heading">
                <h2>{task.title}</h2>
                <div className="scrum-task-actions">
                  <button
                    className="scrum-icon-button"
                    type="button"
                    aria-label={`Sửa ${task.id}`}
                    title="Sửa công việc"
                    onClick={() => openEditor(task)}
                  >
                    <span aria-hidden="true">✎</span>
                  </button>
                  <details className="scrum-more-menu">
                    <summary
                      className="scrum-icon-button"
                      aria-label={`Thao tác với ${task.id}`}
                      title="Thao tác khác"
                    >
                      <span aria-hidden="true">···</span>
                    </summary>
                    <div className="scrum-menu-popover">
                      <button type="button" onClick={() => openEditor(task)}>
                        Sửa công việc
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTasks((currentTasks) =>
                            currentTasks.filter((item) => item.id !== task.id),
                          )
                        }
                      >
                        Xóa công việc
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              <div className="scrum-task-card-footer">
                <div className="scrum-task-key">
                  <span className="scrum-issue-icon" aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <span>{task.id}</span>
                </div>
                <div className="scrum-task-meta">
                  <select
                    aria-label={`Trạng thái ${task.id}`}
                    className={`scrum-status scrum-status-${task.status
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    value={task.status}
                    onChange={(event) =>
                      updateTask(task.id, {
                        status: event.target.value as ScrumTask["status"],
                      })
                    }
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                  <span className="scrum-assignee" title={`Người phụ trách ${task.assignee}`}>
                    {task.assignee}
                  </span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {editingTask && (
        <div
          className="scrum-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingTask(null);
          }}
        >
          <section
            aria-labelledby="scrum-edit-title"
            aria-modal="true"
            className="scrum-edit-modal"
            role="dialog"
          >
            <div className="scrum-edit-heading">
              <h2 id="scrum-edit-title">Sửa công việc</h2>
              <button
                className="scrum-icon-button"
                type="button"
                aria-label="Đóng"
                onClick={() => setEditingTask(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveTask}>
              <label htmlFor="scrum-task-title">Tên công việc</label>
              <input
                autoFocus
                id="scrum-task-title"
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
                required
              />
              <div className="scrum-edit-actions">
                <button type="button" onClick={() => setEditingTask(null)}>
                  Hủy
                </button>
                <button type="submit">Lưu thay đổi</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default ScrumTaskBoard;