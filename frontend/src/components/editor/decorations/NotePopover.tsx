import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { X, FileText } from 'lucide-react';
import { RichTextToolbar } from '../RichTextToolbar';

interface NotePopoverProps {
    note: string;
    onSave: (html: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    trigger: React.ReactNode;
}

export function NotePopover({
    note,
    onSave,
    onOpenChange,
    open,
    trigger
}: NotePopoverProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    // 用一个 ref 来记录"用户是否真的编辑过内容"
    const hasEditedRef = useRef(false);

    // 每次打开弹窗时，重置状态并加载内容
    useEffect(() => {
        if (open) {
            setIsEditing(false);
            hasEditedRef.current = false;
            // 延迟一帧确保 DOM 已挂载
            requestAnimationFrame(() => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = note || '';
                }
            });
        }
    }, [open, note]);

    const handleSave = useCallback(() => {
        if (editorRef.current) {
            onSave(editorRef.current.innerHTML);
        }
        onOpenChange(false);
        setIsEditing(false);
        hasEditedRef.current = false;
    }, [onSave, onOpenChange]);

    return (
        <Popover.Root open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
                // 关闭时：只有用户真正编辑过才自动保存
                if (hasEditedRef.current && editorRef.current) {
                    onSave(editorRef.current.innerHTML);
                }
                setIsEditing(false);
                hasEditedRef.current = false;
            }
            onOpenChange(isOpen);
        }}>
            <Popover.Trigger asChild>
                {trigger}
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-[600px] h-[500px] rounded-xl bg-white p-4 shadow-xl border border-gray-200 outline-none flex flex-col gap-3"
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
                            <FileText className="w-4 h-4" />
                            插入注释
                        </div>
                        <Popover.Close asChild>
                            <button className="text-gray-400 hover:text-gray-600 outline-none">
                                <X className="w-4 h-4" />
                            </button>
                        </Popover.Close>
                    </div>

                    <div className="flex flex-col border border-gray-200 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all flex-1 min-h-0">
                        {/* Toolbar Area — 浅色平铺样式 */}
                        <div className="bg-gray-50 border-b border-gray-200 px-2 py-1.5 shrink-0">
                            <RichTextToolbar
                                editorRef={editorRef}
                                isEditing={isEditing}
                                onEnterEdit={() => setIsEditing(true)}
                                theme="light"
                            />
                        </div>

                        {/* Editor Area */}
                        <div
                            ref={editorRef}
                            contentEditable={true}
                            suppressContentEditableWarning
                            onFocus={() => setIsEditing(true)}
                            onInput={() => { hasEditedRef.current = true; }}
                            onKeyDown={(e) => {
                                // Ctrl+Enter 保存
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSave();
                                }
                                // 阻止冒泡到画布
                                e.stopPropagation();
                            }}
                            className="flex-1 p-3 text-sm text-gray-800 outline-none cursor-text whitespace-pre-wrap break-words overflow-y-auto"
                            style={{ lineHeight: 1.6 }}
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-1 shrink-0">
                        <div className="text-xs text-gray-400 flex items-center mr-auto">
                            (Ctrl+Enter 保存)
                        </div>
                        <Popover.Close asChild>
                            <button className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">取消</button>
                        </Popover.Close>
                        <button
                            onClick={handleSave}
                            className="px-4 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary/90"
                        >
                            保存
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
