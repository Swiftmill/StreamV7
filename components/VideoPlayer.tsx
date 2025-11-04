'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export interface SubtitleTrack {
  lang: string;
  label: string;
  url: string;
}

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  subtitles: SubtitleTrack[];
  onProgress?: (progress: number, currentTime: number) => void;
  onEnded?: () => void;
  onReady?: () => void;
}

export default function VideoPlayer({ src, title, poster, subtitles, onProgress, onEnded, onReady }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    const setupPlayer = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const existingTracks = video.querySelectorAll('track');
      existingTracks.forEach((track) => track.remove());

      subtitles.forEach((track) => {
        const trackElement = document.createElement('track');
        trackElement.kind = 'subtitles';
        trackElement.label = track.label;
        trackElement.srclang = track.lang;
        trackElement.src = track.url;
        trackElement.default = track.lang === 'fr';
        video.appendChild(trackElement);
      });

      if (Hls.isSupported() && src.endsWith('.m3u8')) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(src);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = 0;
          onReady?.();
        });
      } else {
        video.src = src;
        video.currentTime = 0;
        video.addEventListener('loadedmetadata', () => {
          onReady?.();
        }, { once: true });
      }
      video.play().catch(() => null);
    };

    setupPlayer();

    const handleTimeUpdate = () => {
      if (!video.duration || Number.isNaN(video.duration)) {
        return;
      }
      onProgress?.(video.currentTime / video.duration, video.currentTime);
    };

    const handleEnded = () => {
      onEnded?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, subtitles, onProgress, onEnded, onReady]);

  return (
    <video
      ref={videoRef}
      key={src}
      className="video-js"
      controls
      playsInline
      poster={poster}
      style={{ width: '100%', maxHeight: '75vh', borderRadius: 'var(--radius)', background: 'black' }}
      title={title}
    />
  );
}
