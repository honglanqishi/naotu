'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'rrweb/dist/rrweb.min.css';

type RrwebModule = typeof import('rrweb');
type RrwebEvent = ConstructorParameters<RrwebModule['Replayer']>[0][number];
type RrwebReplayerInstance = InstanceType<RrwebModule['Replayer']>;
type TimelineResult = 'ok' | 'error' | 'info';

interface TimelineEntry {
    id: number;
    elapsedMs: number;
    detail: string;
    result: TimelineResult;
    eventSnapshot: number;
}

const SCRIPT_OVERVIEW = [
    'Focus and type task title',
    'Change priority to high',
    'Enable desktop notify sync',
    'Save once successfully',
    'Clear title and save (intentional validation error)',
    'Retype title and save again',
    'Scroll activity feed to bottom',
];

const INITIAL_FEED = ['Waiting for recording: run demo to generate replay events.'];

const wait = (ms: number) =>
    new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });

const formatElapsed = (elapsedMs: number) => `T+${(elapsedMs / 1000).toFixed(2)}s`;

const STORAGE_KEY = 'rrweb-lab-events';
const WAIT_TIME_KEY = 'rrweb-lab-wait-time';

export function RrwebPlaybackLab() {
    const router = useRouter();
    const [draftTitle, setDraftTitle] = useState('');
    const [priority, setPriority] = useState<'normal' | 'high'>('normal');
    const [syncNotify, setSyncNotify] = useState(false);
    const [feed, setFeed] = useState<string[]>(INITIAL_FEED);
    const [status, setStatus] = useState('Ready to record');
    const [isGenerating, setIsGenerating] = useState(false);
    const [eventCount, setEventCount] = useState(0);
    const [formError, setFormError] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [lastWaitTime, setLastWaitTime] = useState(0);

    const recordPaneRef = useRef<HTMLDivElement | null>(null);
    const stopRecordRef = useRef<ReturnType<RrwebModule['record']> | null>(null);
    const eventsRef = useRef<RrwebEvent[]>([]);
    const rrwebModuleRef = useRef<RrwebModule | null>(null);
    const timelineIdRef = useRef(0);
    const recordStartAtRef = useRef(0);
    const liveEventCountRef = useRef(0);
    const mockFlowStartRef = useRef(0);

    const pushTimeline = useCallback((detail: string, result: TimelineResult = 'info') => {
        const elapsedMs = Math.max(0, performance.now() - recordStartAtRef.current);
        const nextId = timelineIdRef.current + 1;
        timelineIdRef.current = nextId;

        setTimeline((prev) => [
            ...prev,
            {
                id: nextId,
                elapsedMs,
                detail,
                result,
                eventSnapshot: liveEventCountRef.current,
            },
        ]);
    }, []);

    const loadRrweb = useCallback(async () => {
        if (!rrwebModuleRef.current) {
            rrwebModuleRef.current = await import('rrweb');
        }
        return rrwebModuleRef.current;
    }, []);

    const handleSaveDraft = useCallback(() => {
        const trimmedTitle = draftTitle.trim();
        const savedAt = new Date().toLocaleTimeString('en-GB', { hour12: false });

        if (!trimmedTitle) {
            const errorText = `[${savedAt}] Save failed: title is required`;
            setFormError('Title is required');
            setFeed((prev) => [errorText, ...prev].slice(0, 8));
            setStatus('Save failed: title is required');
            pushTimeline('Click save -> validation failed (empty title)', 'error');
            return;
        }

        const nextLine = `[${savedAt}] Saved "${trimmedTitle}" (priority: ${priority})`;

        setFormError(null);
        setFeed((prev) => [nextLine, ...prev].slice(0, 8));
        setStatus(syncNotify ? 'Saved with desktop notify sync' : 'Saved locally');
        pushTimeline(`Click save -> success: "${trimmedTitle}"`, 'ok');
    }, [draftTitle, priority, pushTimeline, syncNotify]);

    const resetMockState = useCallback(() => {
        setDraftTitle('');
        setPriority('normal');
        setSyncNotify(false);
        setFormError(null);
        setFeed(INITIAL_FEED);
        setStatus('Mock form reset and ready');
    }, []);

    const dispatchInput = (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const runMockFlow = useCallback(async () => {
        const root = recordPaneRef.current;
        if (!root) {
            return;
        }

        mockFlowStartRef.current = performance.now();

        const titleInput = root.querySelector<HTMLInputElement>('[data-demo="title"]');
        const prioritySelect = root.querySelector<HTMLSelectElement>('[data-demo="priority"]');
        const notifyCheckbox = root.querySelector<HTMLInputElement>('[data-demo="notify"]');
        const saveButton = root.querySelector<HTMLButtonElement>('[data-demo="save"]');
        const feedList = root.querySelector<HTMLUListElement>('[data-demo="feed"]');

        if (!titleInput || !prioritySelect || !notifyCheckbox || !saveButton || !feedList) {
            return;
        }

        pushTimeline('Start scripted interactions', 'info');

        titleInput.focus();
        pushTimeline('Focus title input', 'info');
        await wait(650);

        dispatchInput(titleInput, 'Kickoff: review user path');
        pushTimeline('Type title: Kickoff: review user path', 'ok');
        await wait(1000);

        prioritySelect.focus();
        prioritySelect.value = 'high';
        prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));
        pushTimeline('Switch priority: normal -> high', 'ok');
        await wait(900);

        notifyCheckbox.click();
        pushTimeline('Enable desktop notify sync', 'ok');
        await wait(900);

        saveButton.click();
        pushTimeline('Trigger first save', 'info');
        await wait(1100);

        dispatchInput(titleInput, '');
        pushTimeline('Clear title before intentional error', 'info');
        await wait(800);

        saveButton.click();
        pushTimeline('Trigger second save (expected fail)', 'info');
        await wait(1100);

        dispatchInput(titleInput, 'Generate rrweb replay demo');
        pushTimeline('Retype title: Generate rrweb replay demo', 'ok');
        await wait(900);

        saveButton.click();
        pushTimeline('Trigger third save (expected recover)', 'info');
        await wait(1100);

        feedList.scrollTop = feedList.scrollHeight;
        feedList.dispatchEvent(new Event('scroll', { bubbles: true }));
        pushTimeline('Scroll feed to bottom', 'ok');
        await wait(750);
    }, [pushTimeline]);

    const generateAndReplay = useCallback(async () => {
        if (isGenerating) {
            return;
        }

        timelineIdRef.current = 0;
        recordStartAtRef.current = performance.now();
        liveEventCountRef.current = 0;
        setTimeline([]);

        setIsGenerating(true);
        setStatus('Loading rrweb and starting recording...');
        setFormError(null);

        try {
            const rrweb = await loadRrweb();
            const events: RrwebEvent[] = [];

            resetMockState();
            await wait(150);

            const stopRecord = rrweb.record({
                emit(event) {
                    events.push(event);
                    liveEventCountRef.current = events.length;
                },
            });
            stopRecordRef.current = stopRecord ?? null;

            await wait(180);
            await runMockFlow();
            await wait(350);

            if (stopRecord) {
                stopRecord();
            }
            stopRecordRef.current = null;

            eventsRef.current = events;
            setEventCount(events.length);

            // Calculate total wait time
            const totalWaitTime = Math.round(performance.now() - recordStartAtRef.current);
            setLastWaitTime(totalWaitTime);

            // Save events to sessionStorage for playback page
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
            sessionStorage.setItem(WAIT_TIME_KEY, String(totalWaitTime));

            setStatus(`Recording complete: ${events.length} events. Opening fullscreen playback...`);
            pushTimeline(`Recording ended, total rrweb events: ${events.length}`, 'ok');

            // Navigate to fullscreen playback page
            await wait(500);
            router.push('/rrweb-lab/playback');
        } catch (error) {
            setStatus('Recording failed. Please retry.');
            pushTimeline('Recording pipeline aborted due to error', 'error');
            console.error('[rrweb-lab] failed to generate replay', error);
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating, loadRrweb, pushTimeline, resetMockState, runMockFlow, router]);

    const replayLastSession = useCallback(async () => {
        if (eventsRef.current.length === 0) {
            setStatus('No replay data yet. Run a recording first.');
            return;
        }

        // Save current events to sessionStorage
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(eventsRef.current));
        sessionStorage.setItem(WAIT_TIME_KEY, String(lastWaitTime));

        setStatus('Opening fullscreen playback...');
        pushTimeline('Manual action: replay last session', 'info');

        // Navigate to fullscreen playback page
        await wait(300);
        router.push('/rrweb-lab/playback');
    }, [lastWaitTime, pushTimeline, router]);

    const firstErrorIndex = useMemo(() => {
        return timeline.findIndex((item) => item.result === 'error');
    }, [timeline]);

    const firstErrorEntry = firstErrorIndex >= 0 ? timeline[firstErrorIndex] : null;
    const beforeErrorSteps = firstErrorIndex >= 0 ? firstErrorIndex : timeline.length;
    const afterErrorSteps = firstErrorIndex >= 0 ? timeline.length - firstErrorIndex - 1 : 0;
    const beforeErrorEventSnapshot =
        firstErrorIndex > 0 ? timeline[firstErrorIndex - 1].eventSnapshot : 0;
    const finalEventSnapshot = timeline.length > 0 ? timeline[timeline.length - 1].eventSnapshot : 0;

    useEffect(() => {
        return () => {
            stopRecordRef.current?.();
        };
    }, []);

    return (
        <section className="mx-auto w-full max-w-7xl rounded-3xl border border-slate-700 bg-slate-950/70 p-5 text-slate-100 shadow-[0_30px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-cyan-200 sm:text-3xl">
                    rrweb record + replay lab
                </h1>
                <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                    events: {eventCount}
                </span>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={generateAndReplay}
                    disabled={isGenerating}
                    className="rounded-xl bg-cyan-400 px-4 py-2 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isGenerating ? 'Recording...' : 'Run mock flow and replay'}
                </button>
                <button
                    type="button"
                    onClick={replayLastSession}
                    disabled={isGenerating || eventCount === 0}
                    className="rounded-xl border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Replay last run
                </button>
                <p className="text-sm text-slate-300">{status}</p>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-cyan-200">Replay script checklist</h2>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
                    {SCRIPT_OVERVIEW.map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>
            </div>

            {firstErrorEntry ? (
                <div className="mb-6 rounded-2xl border border-rose-500/50 bg-rose-950/30 p-4">
                    <h2 className="text-sm font-semibold text-rose-200">Error anchor and before/after split</h2>
                    <p className="mt-1 text-sm text-rose-100">
                        First error at {formatElapsed(firstErrorEntry.elapsedMs)}, event@
                        {firstErrorEntry.eventSnapshot}.
                    </p>
                    <p className="mt-1 text-xs text-rose-100/90">
                        Before error: {beforeErrorSteps} steps (event@{beforeErrorEventSnapshot}).
                        After error: {afterErrorSteps} steps (final event@{finalEventSnapshot}).
                    </p>
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                    <h2 className="mb-4 text-lg font-medium text-sky-200">Recorded mock page</h2>
                    <div ref={recordPaneRef} className="space-y-4">
                        <label className="block space-y-2">
                            <span className="text-sm text-slate-300">Task title</span>
                            <input
                                data-demo="title"
                                value={draftTitle}
                                onChange={(event) => setDraftTitle(event.target.value)}
                                placeholder="Type your task title"
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-300 transition focus:ring-2"
                            />
                        </label>

                        <label className="block space-y-2">
                            <span className="text-sm text-slate-300">Priority</span>
                            <select
                                data-demo="priority"
                                value={priority}
                                onChange={(event) =>
                                    setPriority(event.target.value as 'normal' | 'high')
                                }
                                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-300 transition focus:ring-2"
                            >
                                <option value="normal">normal</option>
                                <option value="high">high</option>
                            </select>
                        </label>

                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                data-demo="notify"
                                type="checkbox"
                                checked={syncNotify}
                                onChange={(event) => setSyncNotify(event.target.checked)}
                                className="h-4 w-4 rounded border-slate-500"
                            />
                            Sync desktop reminder after save
                        </label>

                        <button
                            data-demo="save"
                            type="button"
                            onClick={handleSaveDraft}
                            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
                        >
                            Save draft
                        </button>

                        {formError ? (
                            <div className="rounded-lg border border-rose-400/50 bg-rose-950/50 px-3 py-2 text-xs text-rose-100">
                                Form error: {formError}
                            </div>
                        ) : null}

                        <ul
                            data-demo="feed"
                            className="max-h-36 space-y-2 overflow-auto rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-200"
                        >
                            {feed.map((line, index) => (
                                <li key={`${line}-${index}`}>{line}</li>
                            ))}
                        </ul>
                    </div>
                </article>

                <article className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                    <h2 className="mb-4 text-lg font-medium text-violet-200">rrweb playback</h2>
                    {eventCount > 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center">
                            <div className="mb-4 text-4">🎬</div>
                            <p className="mb-2 text-sm text-slate-200">
                                Recording ready: <span className="font-semibold text-cyan-300">{eventCount}</span> events
                            </p>
                            <p className="mb-6 text-xs text-slate-400">
                                Opens in fullscreen tab with timeline progress
                            </p>
                            <button
                                type="button"
                                onClick={replayLastSession}
                                className="rounded-xl bg-violet-400 px-6 py-2.5 font-medium text-slate-950 transition hover:bg-violet-300"
                            >
                                Open fullscreen playback
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center">
                            <div className="mb-4 text-4">📹</div>
                            <p className="text-sm text-slate-400">
                                No replay yet. Click "Run mock flow and replay" above.
                            </p>
                        </div>
                    )}
                </article>
            </div>

            <article className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <h2 className="mb-3 text-lg font-medium text-amber-200">Action timeline with event snapshots</h2>
                <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                    {timeline.length === 0 ? (
                        <p className="text-sm text-slate-400">Timeline is empty. Start a recording.</p>
                    ) : (
                        timeline.map((item) => {
                            const toneClass =
                                item.result === 'error'
                                    ? 'border-rose-500/50 bg-rose-950/40 text-rose-100'
                                    : item.result === 'ok'
                                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100'
                                      : 'border-slate-600 bg-slate-900 text-slate-200';

                            return (
                                <div key={item.id} className={`rounded-md border px-3 py-2 text-xs ${toneClass}`}>
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">#{item.id}</span>
                                        <span>{formatElapsed(item.elapsedMs)}</span>
                                        <span>event@{item.eventSnapshot}</span>
                                    </div>
                                    <p>{item.detail}</p>
                                </div>
                            );
                        })
                    )}
                </div>
            </article>
        </section>
    );
}
