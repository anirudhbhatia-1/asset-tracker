import { createElement } from 'react';
import { AlertTriangle } from 'lucide-react';

// Toast icons drawn with the app's SVG icon set rather than emoji, which look
// different on every platform.
export const warningIcon = () => createElement(AlertTriangle, { className: 'w-4 h-4 text-warning shrink-0', 'aria-hidden': true });
