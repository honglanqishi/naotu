import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X, MessageSquare, Trash2, Edit2 } from 'lucide-react';

export interface CommentData {
    id: string;
    text: string;
    author: string;
    createdAt: number;
}

interface CommentPopoverProps {
    comments: CommentData[];
    onAdd: (text: string) => void;
    onUpdate: (id: string, text: string) => void;
    onDelete: (id: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    trigger: React.ReactNode;
}

export function CommentPopover({
    comments,
    onAdd,
    onUpdate,
    onDelete,
    onOpenChange,
    open,
    trigger
}: CommentPopoverProps) {
    const [text, setText] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const handleSend = () => {
        if (!text.trim()) return;
        onAdd(text.trim());
        setText('');
    };

    const handleUpdate = (id: string) => {
        if (!editText.trim()) return;
        onUpdate(id, editText.trim());
        setEditingId(null);
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                {trigger}
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-[400px] rounded-xl bg-white p-4 shadow-xl border border-gray-200 outline-none flex flex-col gap-4"
                    sideOffset={8}
                    side="bottom"
                    align="start"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onInteractOutside={(e) => {
                        const target = e.target as Node;
                        if (!document.documentElement.contains(target)) {
                            e.preventDefault();
                        }
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100">
                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                            <MessageSquare className="w-4 h-4" />
                            添加评论
                        </div>
                        <Popover.Close asChild>
                            <button className="text-gray-400 hover:text-gray-600 outline-none">
                                <X className="w-4 h-4" />
                            </button>
                        </Popover.Close>
                    </div>

                    {/* Input Area */}
                    <div className="flex gap-2 items-stretch">
                        <textarea
                            className="flex-1 min-h-[60px] border border-gray-200 rounded-md p-2 text-sm text-gray-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-all"
                            placeholder="输入评论..."
                            value={text}
                            onChange={(e) => {
                                if (e.target.value.length <= 300) {
                                    setText(e.target.value);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <div className="flex flex-col items-center justify-between bg-gray-50 rounded-md p-1 border border-gray-100 w-[60px]">
                            <button
                                onClick={handleSend}
                                disabled={!text.trim()}
                                className="w-full bg-primary text-white text-xs py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                            >
                                发送
                            </button>
                            <span className="text-[10px] text-gray-400 font-mono tracking-tighter">
                                {text.length}/300
                            </span>
                        </div>
                    </div>

                    {/* Comments List */}
                    {comments.length > 0 && (
                        <div className="max-h-[250px] overflow-y-auto pr-2 flex flex-col gap-3">
                            {comments.map((comment) => (
                                <div key={comment.id} className="bg-gray-50 rounded-lg p-3 text-sm flex flex-col gap-1 group">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                        <div className="flex items-center gap-1 font-medium text-gray-600">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            {comment.author}
                                        </div>
                                        <span>{formatDate(comment.createdAt)}</span>
                                    </div>

                                    {editingId === comment.id ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                className="w-full min-h-[50px] border border-gray-300 rounded p-1.5 text-xs text-gray-800 outline-none focus:border-primary resize-none"
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
                                                <button onClick={() => handleUpdate(comment.id)} className="text-xs text-primary hover:text-primary/80 font-medium">确定</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.text}</div>
                                    )}

                                    {/* Actions (visible on hover) */}
                                    {editingId !== comment.id && (
                                        <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingId(comment.id); setEditText(comment.text); }}
                                                className="text-[11px] text-gray-400 hover:text-primary flex items-center gap-0.5"
                                            >
                                                修改
                                            </button>
                                            <button
                                                onClick={() => onDelete(comment.id)}
                                                className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                                            >
                                                删除
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
