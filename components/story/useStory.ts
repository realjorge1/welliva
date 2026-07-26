/**
 * useStory / useStoryArchive — bridge hooks for long-horizon storytelling (P6).
 *
 * Thin wiring over StoryService. AppContext generates + archives ready stories on load;
 * these hooks just read them for the screen and the archive list.
 */
import {
  getStory,
  listArchivedStories,
  type StoryArtifact,
} from "@/services/StoryService";
import { useCallback, useEffect, useState } from "react";

export function useStory(id: string | undefined): {
  loading: boolean;
  story: StoryArtifact | null;
} {
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<StoryArtifact | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const s = id ? await getStory(id) : null;
      if (!cancelled) {
        setStory(s);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { loading, story };
}

export function useStoryArchive(): { loading: boolean; stories: StoryArtifact[]; reload: () => Promise<void> } {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<StoryArtifact[]>([]);

  const reload = useCallback(async () => {
    setStories(await listArchivedStories());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, stories, reload };
}
