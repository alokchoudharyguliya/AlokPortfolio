/**
 * Drive-mode route views. The home route renders nothing of its own: the whole
 * experience (road, cockpit, panels) lives in DriveLayout. The other routes
 * (project, post, blog index, 404) reuse Simple's article views; DriveLayout
 * shows them in an overlay above the idling scene.
 */
import type { Bootstrap } from "@/api/types";
import type { AnySectionModel } from "@/domain/sections";
import {
  BlogIndexView as SimpleBlogIndex,
  NotFoundView as SimpleNotFound,
  PostView as SimplePost,
  ProjectView as SimpleProject,
} from "@/modes/simple/views";

export function HomeView(_props: { bootstrap: Bootstrap; sections: AnySectionModel[] }) {
  return null;
}

export const ProjectView = SimpleProject;
export const BlogIndexView = SimpleBlogIndex;
export const PostView = SimplePost;
export const NotFoundView = SimpleNotFound;
