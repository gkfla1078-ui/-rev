import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import saveAs from 'file-saver';
import { PlateItem, GmpReportConfig, DocxExportOptions, GmpMonitoringType } from '../types';
import { groupPlatesToGmpRows, DEFAULT_GMP_CONFIG, getMonitoringTitles, formatLocationWithRoomAndPoint } from './gmpMatcher';

/**
 * Converts a base64 Data URL to a Uint8Array for docx ImageRun
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * GMP BQ-064-002-02 표준 양식 Word 문서(.docx) 생성
 * 
 * [표준 양식 레이아웃 필수 규칙 준수]
 * 1. 머리글: 좌측 "BiONEER", 우측 "[선택된 균 종류] 사진 일지 [현재]/[전체]"
 * 2. 바닥글: 좌측 "BQ-064-002-02", 중앙 "Revision : 1(2025-10-01)", 우측 "A4(210X297)"
 * 3. 상단 기본정보 테이블: 4행 2열 (시험 항목: "미생물 모니터링 결과 - [선택된 균 종류] 사진", 시험 장소, 측정 일자/확인일자, 측정 상태)
 * 4. 메인 결과 매칭 테이블: 3열 구조 [1열: 측정위치 / 2열: 세균 (TSA 사진만) / 3열: 진균 (SDA/SDAC 사진만)]
 * 5. 텍스트 정제: 셀 내부에 "판독결과", "0 CFU", "[TSA] 배지 식별" 등의 문구를 절대 넣지 않고 순수 크롭 배지 사진만 배치
 */
export async function generateWordAppendix(
  plates: PlateItem[],
  options: Partial<GmpReportConfig & DocxExportOptions> = {}
): Promise<void> {
  const monType: GmpMonitoringType = options.monitoringType || '낙하균';
  const defaultTitles = getMonitoringTitles(monType);

  const cfg: GmpReportConfig = {
    formNumber: options.formNumber || DEFAULT_GMP_CONFIG.formNumber,
    revisionText: options.revisionText || DEFAULT_GMP_CONFIG.revisionText,
    paperSize: options.paperSize || DEFAULT_GMP_CONFIG.paperSize,
    companyLogo: options.companyLogo || DEFAULT_GMP_CONFIG.companyLogo,
    monitoringType: monType,
    journalTitle: options.journalTitle || defaultTitles.journalTitle,
    testItem: options.testItem || defaultTitles.testItem,
    testLocation: options.testLocation || options.companyName || DEFAULT_GMP_CONFIG.testLocation,
    measurementPeriod: options.measurementPeriod || plates[0]?.measuredDate || plates[0]?.samplingDate || DEFAULT_GMP_CONFIG.measurementPeriod,
    measurementStatus: options.measurementStatus || DEFAULT_GMP_CONFIG.measurementStatus,
    imageWidthInches: options.imageWidthInches || 2.85,
  };

  const matchedRows = groupPlatesToGmpRows(plates);

  if (matchedRows.length === 0) {
    throw new Error('내보낼 배지 사진 데이터가 없습니다.');
  }

  // Black solid border 1px (size 8 in eighths of pt)
  const borderBlack = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
  const tableBordersBlack = {
    top: borderBlack,
    bottom: borderBlack,
    left: borderBlack,
    right: borderBlack,
    insideHorizontal: borderBlack,
    insideVertical: borderBlack,
  };

  // Header Table (Border none, table outer left/right layout)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: cfg.companyLogo,
                    bold: true,
                    size: 26,
                    font: 'Arial',
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${cfg.journalTitle} `,
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                    color: '000000',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 20,
                    bold: true,
                    font: '맑은 고딕',
                  }),
                  new TextRun({
                    text: '/',
                    size: 20,
                    font: '맑은 고딕',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 20,
                    bold: true,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Footer Table (Border none, Left: BQ-064-002-02, Center: Revision : 1(2025-10-01), Right: A4(210X297))
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: cfg.formNumber,
                    size: 16,
                    font: '맑은 고딕',
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: cfg.revisionText,
                    size: 16,
                    font: '맑은 고딕',
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: cfg.paperSize,
                    size: 16,
                    font: '맑은 고딕',
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // [2. 상단 기본정보 테이블 구조]
  // 4행 2열: 시험 항목, 시험 장소, 측정 일자/확인일자, 측정 상태
  const topInfoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBordersBlack,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '시험 항목',
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 140 },
                children: [
                  new TextRun({
                    text: cfg.testItem,
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '시험 장소',
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 140 },
                children: [
                  new TextRun({
                    text: cfg.testLocation,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '측정 일자',
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 140 },
                children: [
                  new TextRun({
                    text: cfg.measurementPeriod,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC' },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '측정 상태',
                    bold: true,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 140 },
                children: [
                  new TextRun({
                    text: cfg.measurementStatus,
                    size: 20,
                    font: '맑은 고딕',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // [3. 메인 결과 매칭 테이블 구조 (핵심)]
  // 1열: 측정위치 | 2열: 세균 (TSA 배지 관찰 사진 및 결과) | 3열: 진균 (SDA/SDAC 배지 관찰 사진 및 결과)
  const baseImageWidthPt = Math.round(cfg.imageWidthInches * 72); // e.g. 2.85 * 72 = ~205 pt

  const mainTableRows: TableRow[] = [
    // Header row
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '측정위치',
                  bold: true,
                  size: 22,
                  font: '맑은 고딕',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '세균',
                  bold: true,
                  size: 22,
                  font: '맑은 고딕',
                }),
                new TextRun({
                  text: ' (TSA)',
                  size: 18,
                  font: '맑은 고딕',
                  color: '475569',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '진균',
                  bold: true,
                  size: 22,
                  font: '맑은 고딕',
                }),
                new TextRun({
                  text: ' (SDA/SDAC)',
                  size: 18,
                  font: '맑은 고딕',
                  color: '475569',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // Helper to build a plate cell content with high resolution & aspect ratio preservation
  const buildPlateCellChildren = (plate?: PlateItem, _defaultMedia?: string) => {
    if (!plate || (!plate.croppedImage && !plate.originalImage)) {
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: '-',
              size: 24,
              color: '94A3B8',
            }),
          ],
        }),
      ];
    }

    const imgDataUrl = plate.croppedImage || plate.originalImage;
    const imgBytes = dataUrlToUint8Array(imgDataUrl);
    const isPng = !imgDataUrl.startsWith('data:image/jpeg');

    // Calculate aspect ratio so the image is not distorted or squashed
    const imgWidth = plate.width || 800;
    const imgHeight = plate.height || 800;
    const aspect = imgHeight > 0 && imgWidth > 0 ? imgHeight / imgWidth : 1;
    // Keep aspect ratio within reasonable range [0.8, 1.25] for clean table cell filling
    const targetWidth = Math.min(215, Math.max(195, baseImageWidthPt));
    const targetHeight = Math.round(targetWidth * Math.min(1.25, Math.max(0.8, aspect)));

    return [
      // Clean High-Resolution Cropped Plate Image Only (Lossless quality)
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [
          new ImageRun({
            data: imgBytes,
            transformation: {
              width: targetWidth,
              height: targetHeight,
            },
            type: isPng ? 'png' : 'jpg',
          }),
        ],
      }),
    ];
  };

  // Populate rows for each Location Code, formatted to reflect the entered room (실) + handwritten point (-1, -2)
  for (let i = 0; i < matchedRows.length; i++) {
    const rowData = matchedRows[i];

    // Determine the room name (실) for this row
    const rowRoom = rowData.bacteriaPlate?.room || rowData.fungiPlate?.room || rowData.room || cfg.testLocation;
    const rawLoc = rowData.locationCode;
    const pointNum = rowData.bacteriaPlate?.pointNumber || rowData.fungiPlate?.pointNumber || rowData.pointNumber;

    // Compose the formatted measurement point: [입력한 실] + [손글씨 포인트 (예: -1, -2)]
    const fullLocationTitle = formatLocationWithRoomAndPoint(rowRoom, pointNum, rawLoc);

    const locationChildren = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: fullLocationTitle,
            bold: true,
            size: 24, // 12pt
            font: '맑은 고딕',
            color: '000000',
          }),
        ],
      }),
    ];

    mainTableRows.push(
      new TableRow({
        children: [
          // 1열: 측정위치 (입력한 실과 포인트 매칭)
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: locationChildren,
          }),
          // 2열: 세균 (TSA)
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: buildPlateCellChildren(rowData.bacteriaPlate, 'TSA'),
          }),
          // 3열: 진균 (SDA/SDAC)
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: buildPlateCellChildren(rowData.fungiPlate, 'SDA'),
          }),
        ],
      })
    );
  }

  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBordersBlack,
    rows: mainTableRows,
  });

  // Assemble Complete Document with Header & Footer in section
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch (12.7 mm)
              bottom: 720,
              left: 720,
              right: 720,
              header: 360,
              footer: 360,
            },
          },
        },
        headers: {
          default: new Header({
            children: [headerTable],
          }),
        },
        footers: {
          default: new Footer({
            children: [footerTable],
          }),
        },
        children: [
          // Top Info Table
          topInfoTable,
          // Gap Paragraph
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [],
          }),
          // Main 3-column Matching Table
          mainTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `GMP_낙하균_사진일지_${cfg.formNumber}_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
}
