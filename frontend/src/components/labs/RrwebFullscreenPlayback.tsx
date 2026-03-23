'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'rrweb/dist/rrweb.min.css';
import { useRouter } from 'next/navigation';

type RrwebModule = typeof import('rrweb');
type RrwebEvent = ConstructorParameters<RrwebModule['Replayer']>[0][number];
type RrwebReplayerInstance = InstanceType<RrwebModule['Replayer']>;

const STORAGE_KEY = 'rrweb-lab-events';
const WAIT_TIME_KEY = 'rrweb-lab-wait-time';

export function RrwebFullscreenPlayback() {
    const router = useRouter();
    const replayPaneRef = useRef<HTMLDivElement | null>(null);
    const replayerRef = useRef<RrwebReplayerInstance | null>(null);
    const rrwebModuleRef = useRef<RrwebModule | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const loadRrweb = useCallback(async () => {
        if (!rrwebModuleRef.current) {
            rrwebModuleRef.current = await import('rrweb');
        }
        return rrwebModuleRef.current;
    }, []);

    const fitReplayToPane = useCallback((pane: HTMLDivElement) => {
        const wrapper = pane.querySelector<HTMLElement>('.replayer-wrapper');
        const iframe = pane.querySelector<HTMLIFrameElement>('iframe');
        if (!wrapper || !iframe) {
            return;
        }

        const baseWidth = iframe.clientWidth || 1;
        const baseHeight = iframe.clientHeight || 1;
        const paneWidth = window.innerWidth;
        const paneHeight = window.innerHeight;
        const scale = Math.min(paneWidth / baseWidth, paneHeight / baseHeight);

        wrapper.style.transformOrigin = 'top left';
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.width = `${baseWidth}px`;
        wrapper.style.height = `${baseHeight}px`;
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '50%';
        wrapper.style.transformOrigin = 'top center';
        wrapper.style.marginLeft = `-${(baseWidth * scale) / 2}px`;
    }, []);

    const mountReplayer = useCallback(
        async (events: RrwebEvent[], waitTime: number) => {
            const replayPane = replayPaneRef.current;
            if (!replayPane || events.length === 0) {
                setError('No replayable events found. Please record first.');
                setIsLoading(false);
                return;
            }

            const rrweb = await loadRrweb();
            replayPane.innerHTML = '';
            setError(null);

            const replayer = new rrweb.Replayer(events, {
                root: replayPane,
                showWarning: false,
                skipInactive: false,
                speed: 1,
                mouseTail: false,
            });

            replayerRef.current = replayer;
            setIsLoading(false);
            setIsPlaying(true);

            // Auto play after short delay
            replayer.play(0);

            // Calculate duration based on waitTime
            setDuration(waitTime);

            // Setup progress tracking
            const startTime = performance.now();
            const updateProgress = () => {
                if (replayerRef.current) {
                    const elapsed = performance.now() - startTime;
                    const progressPercent = Math.min((elapsed / waitTime) * 100, 100);
                    setProgress(progressPercent);

                    if (progressPercent < 100) {
                        requestAnimationFrame(updateProgress);
                    }
                }
            };
            requestAnimationFrame(updateProgress);

            window.setTimeout(() => fitReplayToPane(replayPane), 0);
            window.setTimeout(() => fitReplayToPane(replayPane), 250);
            window.setTimeout(() => fitReplayToPane(replayPane), 500);
        },
        [fitReplayToPane, loadRrweb]
    );

    const handleGoBack = useCallback(() => {
        router.push('/rrweb-lab');
    }, [router]);

    const handleFullscreenExit = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        handleGoBack();
    }, [handleGoBack]);

    useEffect(() => {
        const eventsJson = sessionStorage.getItem(STORAGE_KEY);
        const waitTime = parseInt(sessionStorage.getItem(WAIT_TIME_KEY) || '10000', 10);

        if (!eventsJson) {
            setError('No recording data found. Please record first.');
            setIsLoading(false);
            return;
        }

        try {
            const events: RrwebEvent[] = JSON.parse(eventsJson);
            mountReplayer(events, waitTime);
        } catch {
            setError('Failed to parse recording data.');
            setIsLoading(false);
        }

        return () => {
            replayerRef.current?.pause();
            replayerRef.current = null;
        };
    }, [mountReplayer]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleFullscreenExit();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleFullscreenExit]);

    return (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#020617]">
            {/* Header bar */}
            <div className="absolute left-0 right-0 top-0 z-10 flex h-14 items-center justify-between bg-slate-900/80 px-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleGoBack}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                    >
                        Back to Lab
                    </button>
                    <h1 className="text-lg font-medium text-cyan-200">rrweb Fullscreen Playback</h1>
                </div>

                {isPlaying && (
                    <button
                        onClick={handleFullscreenExit}
                        className="rounded-lg bg-cyan-400 px-4 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                    >
                        Exit Playback
                    </button>
                )}
            </div>

            {/* Replayer container */}
            <div className="relative mt-14 h-[calc(100vh-56px)] w-full overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90">
                        <div className="text-center">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                            <p className="mt-3 text-slate-300">Loading replay...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90">
                        <p className="mb-4 text-lg text-rose-300">{error}</p>
                        <button
                            onClick={handleGoBack}
                            className="rounded-lg bg-cyan-400 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-300"
                        >
                            Go back to record
                        </button>
                    </div>
                )}

                {/* Progress bar */}
                {isPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 z-10 h-1 bg-slate-800">
                        <div
                            className="h-full bg-cyan-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <div
                    ref={replayPaneRef}
                    className="flex h-full w-full items-center justify-center"
                    style={{ backgroundColor: '#ffffff' }}
                />
            </div>
        </div>
    );
}
