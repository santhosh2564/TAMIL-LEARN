import sunSvg from '../assets/pin/sun.svg';
import starSvg from '../assets/pin/star.svg';
import treeSvg from '../assets/pin/tree.svg';
import flowerSvg from '../assets/pin/flower.svg';
import fishSvg from '../assets/pin/fish.svg';
import birdSvg from '../assets/pin/bird.svg';
import appleSvg from '../assets/pin/apple.svg';
import houseSvg from '../assets/pin/house.svg';
import carSvg from '../assets/pin/car.svg';

/**
 * 9 original, non-copyrighted picture PIN symbols with Tamil & English labels.
 * Used for Class 2-3 child authentication on shared lab desktops.
 * All rendered as bundled SVG images without any emoji characters.
 */

export interface PicturePinItem {
  id: string;
  labelEn: string;
  labelTa: string;
  svg: string;
}

export const PICTURE_PIN_ITEMS: PicturePinItem[] = [
  { id: 'sun', labelEn: 'Sun', labelTa: 'சூரியன்', svg: sunSvg },
  { id: 'star', labelEn: 'Star', labelTa: 'நட்சத்திரம்', svg: starSvg },
  { id: 'tree', labelEn: 'Tree', labelTa: 'மரம்', svg: treeSvg },
  { id: 'flower', labelEn: 'Flower', labelTa: 'மலர்', svg: flowerSvg },
  { id: 'fish', labelEn: 'Fish', labelTa: 'மீன்', svg: fishSvg },
  { id: 'bird', labelEn: 'Bird', labelTa: 'பறவை', svg: birdSvg },
  { id: 'apple', labelEn: 'Apple', labelTa: 'ஆப்பிள்', svg: appleSvg },
  { id: 'house', labelEn: 'House', labelTa: 'வீடு', svg: houseSvg },
  { id: 'car', labelEn: 'Car', labelTa: 'வண்டி', svg: carSvg },
];

export const PICTURE_PIN_MAP: Record<string, PicturePinItem> = Object.fromEntries(
  PICTURE_PIN_ITEMS.map((item) => [item.id, item])
);
