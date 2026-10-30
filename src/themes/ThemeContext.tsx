import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { load, remove, save } from '../lib/storage';

export interface Scene {
  id: string;
  name: string;
  src: string;
  pos: string; // CSS object-position
}

const B = import.meta.env.BASE_URL;
// Default background. Swap public/scenes/default.jpg, or add more entries here (and files in public/scenes).
export const SCENES: Scene[] = [{ id: 'default', name: 'Cat at sunset', src: `${B}scenes/default.jpg`, pos: '30% 55%' }];

const KEY = 'overlap:theme';
const CUSTOM = 'overlap:customScene';

interface Saved {
  sceneId: string;
  night: boolean;
}

interface ThemeValue {
  scene: Scene;
  scenes: Scene[];
  night: boolean;
  peek: boolean;
  setScene: (id: string) => void;
  toggleNight: () => void;
  togglePeek: () => void;
  setCustomImage: (file: File) => Promise<void>;
  setCustomUrl: (url: string) => void;
  clearCustom: () => void;
}

const Ctx = createContext<ThemeValue | null>(null);

async function downscale(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r);
  c.height = Math.round(bmp.height * r);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(() => load<Saved>(KEY, { sceneId: 'default', night: false }));
  const [custom, setCustom] = useState<string | null>(() => load<string | null>(CUSTOM, null));
  const [peek, setPeek] = useState(false);

  const persist = useCallback((s: Saved) => {
    setSaved(s);
    save(KEY, s);
  }, []);

  const scenes = useMemo<Scene[]>(
    () => (custom ? [...SCENES, { id: 'custom', name: 'Your image', src: custom, pos: '50% 50%' }] : SCENES),
    [custom],
  );
  const scene = scenes.find((s) => s.id === saved.sceneId) ?? SCENES[0];

  const value: ThemeValue = {
    scene,
    scenes,
    night: saved.night,
    peek,
    setScene: (id) => persist({ ...saved, sceneId: id }),
    toggleNight: () => persist({ ...saved, night: !saved.night }),
    togglePeek: () => setPeek((p) => !p),
    setCustomImage: async (file) => {
      const url = await downscale(file);
      if (!save(CUSTOM, url)) throw new Error('Image too large to store in this browser.');
      setCustom(url);
      persist({ ...saved, sceneId: 'custom' });
    },
    setCustomUrl: (url) => {
      save(CUSTOM, url);
      setCustom(url);
      persist({ ...saved, sceneId: 'custom' });
    },
    clearCustom: () => {
      remove(CUSTOM);
      setCustom(null);
      persist({ ...saved, sceneId: 'default' });
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('ThemeProvider missing');
  return v;
}
