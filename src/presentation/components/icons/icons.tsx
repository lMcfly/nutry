import { makeIcon } from './Icon';

/* Jeu de pictogrammes maison, au trait fin. */

export const HomeIcon = makeIcon(
  <>
    <path d="M4 11.2 12 4.5l8 6.7" />
    <path d="M6 10v9.5h12V10" />
    <path d="M10 19.5v-5h4v5" />
  </>,
);

export const BasketIcon = makeIcon(
  <>
    <path d="M3.5 9.5h17l-1.7 9.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3L3.5 9.5Z" />
    <path d="m8 9.5 3-5M16 9.5l-3-5" />
  </>,
);

export const PersonIcon = makeIcon(
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
  </>,
);

export const TrendIcon = makeIcon(
  <>
    <path d="M4 19.5h16" />
    <path d="m5 15 4.5-4.5 3.5 3L19 7" />
    <path d="M15 7h4v4" />
  </>,
);

export const SettingsIcon = makeIcon(
  <>
    <path d="M5 7h8M17 7h2M5 17h2M11 17h8" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
);

export const FlameIcon = makeIcon(
  <path d="M12 3.5c.5 3-2.5 4.6-4 7.2-1.6 2.8-.8 6.3 1.8 8 2.6 1.6 6.2 1 7.6-1.7 1.3-2.6.2-5.3-1.6-7.3.1 1.6-.5 2.6-1.5 3.1.4-3-.2-6.5-2.3-9.3Z" />,
);

export const ClockIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const ThumbUpIcon = makeIcon(
  <>
    <path d="M8 10.5V20H5.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H8Z" />
    <path d="M8 10.5 11.2 4c1.4 0 2.3 1.1 2.1 2.5L12.8 10H18a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16.9 20H8" />
  </>,
);

export const ThumbDownIcon = makeIcon(
  <>
    <path d="M8 13.5V4h-2.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1H8Z" />
    <path d="M8 13.5 11.2 20c1.4 0 2.3-1.1 2.1-2.5L12.8 14H18a2 2 0 0 0 2-2.4l-1.2-6A2 2 0 0 0 16.9 4H8" />
  </>,
);

export const SwapIcon = makeIcon(
  <>
    <path d="M4.5 9.5V8a2 2 0 0 1 2-2h12" />
    <path d="m15.5 3 3 3-3 3" />
    <path d="M19.5 14.5V16a2 2 0 0 1-2 2h-12" />
    <path d="m8.5 21-3-3 3-3" />
  </>,
);

export const ArrowLeftIcon = makeIcon(
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
);

export const ChevronLeftIcon = makeIcon(<path d="m14.5 6-6 6 6 6" />);
export const ChevronRightIcon = makeIcon(<path d="m9.5 6 6 6-6 6" />);

export const PlusIcon = makeIcon(<path d="M12 5v14M5 12h14" />);

export const ShareIcon = makeIcon(
  <>
    <path d="M12 15V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </>,
);

export const MoreIcon = makeIcon(
  <>
    <circle cx="5.5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18.5" cy="12" r="1" />
  </>,
);

export const FridgeIcon = makeIcon(
  <>
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <path d="M6 10.5h12M9.5 6.5v1.5M9.5 13v2.5" />
  </>,
);

export const ScaleIcon = makeIcon(
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 9.5a5 5 0 0 1 7 0" />
    <path d="m12 11.5 1.5-2" />
  </>,
);

export const StarIcon = makeIcon(
  <path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8L9.6 9 12 4Z" />,
);

export const LeafIcon = makeIcon(
  <>
    <path d="M5 19c0-8 5-13.5 14.5-14.5C19.5 14 14 19 5 19Z" />
    <path d="M5 19c2.5-4 5.5-6.5 9-8" />
  </>,
);

export const PaletteIcon = makeIcon(
  <>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.5-1.8-.4-1.2.2-2.2 1.5-2.2h1.5a3.5 3.5 0 0 0 3.5-3.5C20 7.3 16.5 3.5 12 3.5Z" />
    <circle cx="8" cy="11" r=".8" />
    <circle cx="11" cy="7.5" r=".8" />
    <circle cx="15.5" cy="8.5" r=".8" />
  </>,
);

export const LockIcon = makeIcon(
  <>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </>,
);

export const DatabaseIcon = makeIcon(
  <>
    <ellipse cx="12" cy="6" rx="7" ry="2.5" />
    <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
    <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
  </>,
);

export const HeartIcon = makeIcon(
  <path d="M12 19.5s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10Z" />,
);

export const CalendarIcon = makeIcon(
  <>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </>,
);

export const TargetIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r=".6" />
  </>,
);

export const SmileIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14c.9 1.2 2 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
    <path d="M9 9.8v.4M15 9.8v.4" />
  </>,
);

export const CheckIcon = makeIcon(<path d="m5.5 12.5 4.2 4.2 8.8-9" />);
export const CloseIcon = makeIcon(<path d="m6 6 12 12M18 6 6 18" />);

export const TrashIcon = makeIcon(
  <>
    <path d="M4.5 7h15M9.5 7V4.5h5V7" />
    <path d="m6.5 7 .8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </>,
);

export const SparkleIcon = makeIcon(
  <>
    <path d="M10 4.5c.5 3.5 2 5 5.5 5.5-3.5.5-5 2-5.5 5.5-.5-3.5-2-5-5.5-5.5C8 9.5 9.5 8 10 4.5Z" />
    <path d="M18 14.5c.2 1.5.8 2.1 2.3 2.3-1.5.2-2.1.8-2.3 2.3-.2-1.5-.8-2.1-2.3-2.3 1.5-.2 2.1-.8 2.3-2.3Z" />
  </>,
);

export const BookIcon = makeIcon(
  <>
    <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19V5.5Z" />
    <path d="M5 19a1.5 1.5 0 0 0 1.5 1.5H19v-3" />
  </>,
);

export const PotIcon = makeIcon(
  <>
    <path d="M5 10.5h14v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5Z" />
    <path d="M3.5 10.5h17M9 7c0-1 1-1 1-2M14 7c0-1 1-1 1-2" />
  </>,
);

export const BulbIcon = makeIcon(
  <>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6v.5h5V15c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5Z" />
  </>,
);

export const ShieldIcon = makeIcon(
  <path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-2.5Z" />,
);

export const InfoIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.2" />
  </>,
);

export const SearchIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>,
);

export const SunIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
  </>,
);

export const MoonIcon = makeIcon(<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5Z" />);

export const CoffeeIcon = makeIcon(
  <>
    <path d="M5 9.5h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9.5Z" />
    <path d="M16 11h1.5a2 2 0 0 1 0 4H16" />
    <path d="M8.5 4.5v2M12 4.5v2" />
  </>,
);

export const RecycleIcon = makeIcon(
  <>
    <path d="M7 8h9.5a3 3 0 0 1 3 3v1" />
    <path d="m14 5.5 2.5 2.5L14 10.5" />
    <path d="M17 16H7.5a3 3 0 0 1-3-3v-1" />
    <path d="M10 18.5 7.5 16 10 13.5" />
  </>,
);

export const DownloadIcon = makeIcon(
  <>
    <path d="M12 4v11" />
    <path d="m8 11 4 4 4-4" />
    <path d="M5 19.5h14" />
  </>,
);

export const UploadIcon = makeIcon(
  <>
    <path d="M12 15.5V4.5" />
    <path d="m8 8.5 4-4 4 4" />
    <path d="M5 19.5h14" />
  </>,
);

export const GlobeIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.500 2.500 3.500 5.300 3.500 8.500s-1 6-3.500 8.500c-2.500-2.500-3.500-5.300-3.500-8.500s1-6 3.500-8.500Z" />
  </>,
);
