/**
 * Modal — 通用弹窗骨架组件
 *
 * 功能：
 *  - 黑色半透明遮罩 + 毛玻璃效果
 *  - 点击遮罩关闭（disabled 时不关闭）
 *  - children 渲染弹窗主体内容
 *
 * 使用示例：
 *   <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} disabled={isPending}>
 *     <h2>弹窗标题</h2>
 *     <p>内容</p>
 *   </Modal>
 */
'use client';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    /** 禁用关闭（如操作进行中） */
    disabled?: boolean;
    /** 弹窗最大宽度，默认 480px */
    maxWidth?: string;
    children: React.ReactNode;
}

export function Modal({ open, onClose, disabled = false, maxWidth = '480px', children }: ModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 遮罩 */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => { if (!disabled) onClose(); }}
            />
            {/* 弹窗主体 */}
            <div
                className="relative z-10 w-full mx-4 bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded-[20px] p-[32px] flex flex-col gap-[24px]"
                style={{ maxWidth }}
            >
                {children}
            </div>
        </div>
    );
}
