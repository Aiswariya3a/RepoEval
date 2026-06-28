import { fetchApi } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  tags?: string[];
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── API Functions ──────────────────────────────────────

export function listProjects(
  page: number = 1,
  pageSize: number = 12
): Promise<PaginatedResponse<Project>> {
  return fetchApi<PaginatedResponse<Project>>(
    `/api/projects?page=${page}&page_size=${pageSize}`
  );
}

export function createProject(
  data: ProjectCreate
): Promise<Project> {
  return fetchApi<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getProject(id: string): Promise<Project> {
  return fetchApi<Project>(`/api/projects/${id}`);
}

export function updateProject(
  id: string,
  data: ProjectUpdate
): Promise<Project> {
  return fetchApi<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string): Promise<void> {
  return fetchApi<void>(`/api/projects/${id}`, {
    method: "DELETE",
  });
}
