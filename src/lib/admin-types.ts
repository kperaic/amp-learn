import type { LessonNode } from "./lesson-document";
export type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  sort_order: number;
  cover_path: string | null;
  updated_at: string;
};
export type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  status: "draft" | "published";
  sort_order: number;
  content: LessonNode;
  bunny_video_id: string | null;
  updated_at: string;
};
export type AttachmentRow = {
  id: string;
  lesson_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  ready: boolean;
};
export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  language: "hr" | "en";
  invited_at: string | null;
  confirmed_at: string | null;
};
export type Result<T = undefined> =
  { error: string; data?: never } | { error?: never; data: T };
export type VideoInfo = {
  id: string;
  title: string;
  status: number;
  duration: number;
};

export type ModuleAccessRow = {
  student_id: string;
  module_id: string;
  granted_at: string;
};
