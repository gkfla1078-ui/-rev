import { PlateItem, GmpMatchedRow, GmpReportConfig, GmpMediaCategory, GmpMonitoringType } from '../types';

export function getMonitoringTitles(type: GmpMonitoringType): {
  journalTitle: string;
  testItem: string;
} {
  return {
    journalTitle: `${type} 사진 일지`,
    testItem: `미생물 모니터링 결과 - ${type} 사진`,
  };
}

export const DEFAULT_GMP_CONFIG: GmpReportConfig = {
  formNumber: 'BQ-064-002-02',
  revisionText: 'Revision : 1(2025-10-01)',
  paperSize: 'A4(210X297)',
  companyLogo: 'BiONEER',
  monitoringType: '낙하균',
  journalTitle: '낙하균 사진 일지',
  testItem: '미생물 모니터링 결과 - 낙하균 사진',
  testLocation: 'Accuprep 분주실',
  measurementPeriod: new Date().toISOString().split('T')[0], // 배지에 작성된 측정일자 (확인일자는 작성 안 함)
  measurementStatus: 'In operation',
  imageWidthInches: 2.85,
};

/**
 * 측정 위치 포맷 함수: [입력한 실] + [배지 손글씨 포인트 (예: -1, -2)]
 * 예: 실이 'Accuprep 분주실'이고 포인트가 '-1'이면 -> 'Accuprep 분주실-1'
 */
export function formatLocationWithRoomAndPoint(room?: string, point?: string, rawLoc?: string): string {
  const cleanRoom = (room || '').trim();
  let cleanPoint = (point || '').trim();

  // "1", "2" 등의 순수 숫자 포인트를 "-1", "-2" 표준 포인트 포맷으로 변환
  if (/^\d+$/.test(cleanPoint)) {
    cleanPoint = `-${cleanPoint}`;
  }

  if (cleanPoint) {
    if (cleanRoom) {
      if (cleanPoint.startsWith('-')) {
        return `${cleanRoom}${cleanPoint}`;
      }
      return `${cleanRoom} ${cleanPoint}`;
    }
    return cleanPoint;
  }

  if (rawLoc) {
    let loc = rawLoc.trim();
    if (cleanRoom && !loc.toLowerCase().includes(cleanRoom.toLowerCase())) {
      if (loc.startsWith('-')) {
        return `${cleanRoom}${loc}`;
      }
      if (/^\d+$/.test(loc)) {
        return `${cleanRoom}-${loc}`;
      }
      return `${cleanRoom} ${loc}`;
    }
    return loc;
  }

  return cleanRoom ? `${cleanRoom}-1` : '측정위치-1';
}

/**
 * Parses and extracts:
 * 1. Normalized Location Code: [입력한 실] + [손글씨 포인트(예: -1, -2)]
 * 2. Medium category: 'bacteria' (세균 - TSA) vs 'fungi' (진균 - SDA / SDAC)
 */
export function parseLocationAndMedia(plate: PlateItem): {
  locationCode: string;
  category: GmpMediaCategory;
  rawMedia: string;
} {
  // If user explicitly overrode in plate item
  if (plate.locationCode && plate.gmpCategory) {
    return {
      locationCode: plate.locationCode,
      category: plate.gmpCategory,
      rawMedia: plate.mediaType || (plate.gmpCategory === 'bacteria' ? 'TSA' : 'SDA'),
    };
  }

  const textToScan = `${plate.zone || ''} ${plate.rawLabel || ''} ${plate.filename || ''} ${plate.mediaType || ''} ${plate.remarks || ''}`;

  // 1. Determine category: 'bacteria' (세균 - TSA) vs 'fungi' (진균 - SDA / SDAC)
  let category: GmpMediaCategory = 'bacteria';
  const isFungi = /SDA|SDAC|진균|Fungi|곰팡이/i.test(textToScan);
  const isBacteria = /TSA|세균|Bacteria/i.test(textToScan);

  if (isFungi && !isBacteria) {
    category = 'fungi';
  } else if (isBacteria && !isFungi) {
    category = 'bacteria';
  } else if (isFungi && isBacteria) {
    if (/SDA|SDAC|진균/i.test(plate.mediaType || '')) {
      category = 'fungi';
    } else {
      category = 'bacteria';
    }
  } else {
    if (/SDA|SDAC/i.test(plate.mediaType || '')) {
      category = 'fungi';
    } else {
      category = 'bacteria';
    }
  }

  // 2. Extract and Normalize Location Code based on entered room (실) + handwritten point (-1, -2)
  let rawLoc = (plate.locationCode || plate.pointNumber || plate.zone || plate.plateId || plate.filename || '위치')
    .replace(/\(.*?\)/g, '') // remove (TSA), (SDA), (SDAC)
    .replace(/\[.*?\]/g, '') // remove [TSA], [SDA]
    .replace(/TSA|SDA|SDAC|세균|진균/gi, '') // remove media keywords
    .replace(/[\-_]?(tsa|sda|sdac)$/i, '')
    .trim();

  const mMatch = rawLoc.match(/^M([0-9][A-Z0-9\-_.]*)$/i);
  if (mMatch) {
    rawLoc = mMatch[1];
  }

  const formattedLoc = formatLocationWithRoomAndPoint(plate.room, plate.pointNumber, rawLoc);
  const rawMedia = plate.mediaType || (category === 'bacteria' ? 'TSA' : 'SDA');

  return {
    locationCode: formattedLoc,
    category,
    rawMedia,
  };
}

/**
 * Groups a flat list of plates into paired 3-column rows:
 * 1열: 측정위치 (Location Code)
 * 2열: 세균 (TSA 배지 사진 및 결과)
 * 3열: 진균 (SDA/SDAC 배지 사진 및 결과)
 */
export function groupPlatesToGmpRows(plates: PlateItem[]): GmpMatchedRow[] {
  const rowMap = new Map<string, GmpMatchedRow>();

  // Only consider active plates
  const targetPlates = plates.filter((p) => p.croppedImage || p.originalImage);

  for (const plate of targetPlates) {
    const { locationCode, category } = parseLocationAndMedia(plate);

    let row = rowMap.get(locationCode);
    if (!row) {
      row = {
        locationCode,
        room: plate.room,
        pointNumber: plate.pointNumber,
        measuredDate: plate.measuredDate || plate.samplingDate,
      };
      rowMap.set(locationCode, row);
    } else {
      if (!row.room && plate.room) row.room = plate.room;
      if (!row.pointNumber && plate.pointNumber) row.pointNumber = plate.pointNumber;
      if (!row.measuredDate && (plate.measuredDate || plate.samplingDate)) {
        row.measuredDate = plate.measuredDate || plate.samplingDate;
      }
    }

    if (category === 'bacteria') {
      if (!row.bacteriaPlate) {
        row.bacteriaPlate = plate;
      } else {
        // If multiple bacteria plates exist for the same code, append with suffix
        const altKey = `${locationCode} (#2)`;
        let altRow = rowMap.get(altKey);
        if (!altRow) {
          altRow = { locationCode: altKey };
          rowMap.set(altKey, altRow);
        }
        altRow.bacteriaPlate = plate;
      }
    } else {
      if (!row.fungiPlate) {
        row.fungiPlate = plate;
      } else {
        const altKey = `${locationCode} (#2)`;
        let altRow = rowMap.get(altKey);
        if (!altRow) {
          altRow = { locationCode: altKey };
          rowMap.set(altKey, altRow);
        }
        altRow.fungiPlate = plate;
      }
    }
  }

  // Sort rows naturally (e.g. 3E07-1, 3E07-2, 3E09-1...)
  return Array.from(rowMap.values()).sort((a, b) =>
    a.locationCode.localeCompare(b.locationCode, undefined, { numeric: true, sensitivity: 'base' })
  );
}
