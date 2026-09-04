import React from 'react';
import { X } from 'lucide-react';

export const PhotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <img
      src={url}
      alt="完成照片"
      className="max-w-full max-h-full rounded-xl object-contain"
      onClick={e => e.stopPropagation()}
    />
    <button
      onClick={onClose}
      className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
      aria-label="关闭"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export default PhotoLightbox;
