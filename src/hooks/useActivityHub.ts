import { useSyncExternalStore } from "react";
import { getActivityTasks, subscribeActivity } from "../services/activityHub";

export function useActivityHub() {
  return useSyncExternalStore(subscribeActivity, getActivityTasks, getActivityTasks);
}
