import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { PicturePinModal } from '../PicturePinModal';

describe('T3: PIN pictures must be 9 bundled SVG files, without emoji characters', () => {
  const PIN_DIR = path.resolve(process.cwd(), 'src/assets/pin');
  const REQUIRED_SVGS = [
    'sun.svg',
    'star.svg',
    'tree.svg',
    'flower.svg',
    'fish.svg',
    'bird.svg',
    'apple.svg',
    'house.svg',
    'car.svg',
  ];

  it('all 9 required SVG files exist in src/assets/pin/', () => {
    expect(fs.existsSync(PIN_DIR), 'src/assets/pin directory must exist').toBe(true);

    for (const file of REQUIRED_SVGS) {
      const filePath = path.join(PIN_DIR, file);
      expect(fs.existsSync(filePath), `PIN SVG file ${file} must exist in src/assets/pin/`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content.includes('<svg'), `${file} must be valid SVG markup`).toBe(true);
    }
  });

  it('PIN modal renders <img src=*.svg> and contains zero emoji characters in PIN choices', () => {
    render(
      <PicturePinModal
        student={{ id: 'stud_1', name: 'கவின்', avatar: 'avatar_sun' }}
        classCode="ABCDEF"
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    // Assert SVG images are rendered
    const imgElements = screen.getAllByRole('img');
    expect(imgElements.length).toBeGreaterThanOrEqual(9);

    for (const img of imgElements) {
      const src = img.getAttribute('src') || '';
      expect(src.endsWith('.svg'), `Rendered image src "${src}" must be an SVG file`).toBe(true);
    }

    // Assert that the container contains NO unicode emojis
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const modalText = document.body.textContent || '';
    expect(emojiRegex.test(modalText), 'PIN selection screen must not contain emoji characters').toBe(false);
  });
});
