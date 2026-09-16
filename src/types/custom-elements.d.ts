// Web components loaded via <script> tags in layout.tsx / individual pages
// (iconify-icon, lottie-player) rather than imported as React components, plus
// the canvas-confetti global they load alongside. TypeScript/JSX has no idea
// these tags or this global exist without being told here.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type IconifyIconProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  icon?: string;
};

type LottiePlayerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  background?: string;
  speed?: string | number;
  loop?: boolean;
  autoplay?: boolean;
  count?: string | number;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "iconify-icon": IconifyIconProps;
      "lottie-player": LottiePlayerProps;
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var confetti: ((options?: Record<string, unknown>) => void) | undefined;
}

export {};
