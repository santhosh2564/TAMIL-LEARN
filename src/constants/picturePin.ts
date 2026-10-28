/**
 * 9 original, non-copyrighted picture PIN symbols with Tamil & English labels.
 * Used for Class 2-3 child authentication on shared lab desktops.
 */

export interface PicturePinItem {
  id: string;
  labelEn: string;
  labelTa: string;
  emoji: string;
}

export const PICTURE_PIN_ITEMS: PicturePinItem[] = [
  { id: 'sun', labelEn: 'Sun', labelTa: 'சூரியன்', emoji: '☀️' },
  { id: 'star', labelEn: 'Star', labelTa: 'நட்சத்திரம்', emoji: '⭐' },
  { id: 'tree', labelEn: 'Tree', labelTa: 'மரம்', emoji: '🌳' },
  { id: 'flower', labelEn: 'Flower', labelTa: 'மலர்', emoji: '🌸' },
  { id: 'fish', labelEn: 'Fish', labelTa: 'மீன்', emoji: '🐟' },
  { id: 'bird', labelEn: 'Bird', labelTa: 'பறவை', emoji: '🐦' },
  { id: 'apple', labelEn: 'Apple', labelTa: 'ஆப்பிள்', emoji: '🍎' },
  { id: 'house', labelEn: 'House', labelTa: 'வீடு', emoji: '🏠' },
  { id: 'car', labelEn: 'Car', labelTa: 'வண்டி', emoji: '🚗' },
];

export const PICTURE_PIN_MAP: Record<string, PicturePinItem> = Object.fromEntries(
  PICTURE_PIN_ITEMS.map((item) => [item.id, item])
);

