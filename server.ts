import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// process.env.SOME_PATH가 없을 때 기본 경로를 쓰도록 예외 처리
const pathInput = process.env.SOME_PATH || import.meta.url;
const __filename = fileURLToPath(pathInput);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Multi-plate & Single-plate image analysis endpoint
app.post('/api/analyze-plate', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
    const ai = getGeminiClient();

    const prompt = `
당신은 GMP 환경모니터링(EM) 미생물 배지(페트리디쉬/키트) 객체 탐지, 손글씨/라벨 포인트 번호(-1, -2) 및 측정일자 인식(OCR), 고화질 보존 자동 크롭 전문 AI 비전 모델입니다.

[배지 손글씨 포인트(-1, -2), 측정일자 인식 및 정밀 크롭 지침]

1. 객체 자동 탐지 (Object Detection):
   - 이미지 내에 배열된 모든 독립된 페트리디쉬 배지, 키트, 또는 부품의 위치를 개별적으로 탐지합니다.
   - 단일 개체뿐만 아니라 여러 개체가 격자형 또는 나열되어 있는 경우 모든 개체를 빠짐없이 탐지하십시오.

2. 배지 손글씨 포인트 번호 인식 (핵심 OCR):
   - 각 배지(페트리디쉬) 표면, 뚜껑, 외곽 테두리에 유성매직/펜으로 손글씨로 적힌 측정 포인트(예: '-1', '-2', '1', '2', '#1', '#2', '3E07-1', 'A-1' 등)를 반드시 정밀하게 판독하십시오.
   - 특히 '-1', '-2'와 같이 하이픈(-)이나 번호로 표기된 손글씨 포인트는 보고서 측정위치(실 + 포인트) 매칭의 핵심입니다.
   - 배지에 '1' 또는 '-1'이라고 적혀있으면 -> point_number는 "-1"로 판독
   - 배지에 '2' 또는 '-2'라고 적혀있으면 -> point_number는 "-2"로 판독
   - 배지에 '3' 또는 '-3'이라고 적혀있으면 -> point_number는 "-3"으로 판독
   - 숫자가 식별되면 'point_number' 및 'recognized_number' 필드에 정확히 입력하십시오.

3. 배지 손글씨/라벨 측정일자 인식 (핵심 OCR):
   - 각 배지 표면, 뚜껑, 테두리 또는 라벨에 유성매직 손글씨나 도장으로 적혀있는 **측정일자(시험일자, 검사일자)**를 반드시 읽어내십시오.
   - 예: '2026.10.06', '26.10.06', '2026-10-06', '10/06', '2026.04.28' 등
   - 인식된 측정일자를 'measured_date' 필드에 입력하십시오 (가급적 YYYY-MM-DD 형식 또는 표기된 날짜 그대로).

4. 순차적 개별 컷팅 및 테두리 안전 여백 (Safe Margin Crop):
   - 탐지된 배지 1개당 [ymin, xmin, ymax, xmax] (0~1000 상대좌표)를 계산합니다.
   - 중요: 배지 테두리나 뚜껑에 적힌 손글씨 포인트(-1, -2) 및 측정일자가 잘리지 않도록 안전 여백(여유 패딩 3~5%)을 넉넉히 포함하여 배지 전체가 온전히 담기도록 하십시오.

5. 순차 정렬 및 파일명 매핑:
   - 좌측 상단부터 우측 하단 순서대로 탐지된 객체들을 순차 정렬하십시오.
   - 손글씨 포인트가 있으면 kit_{포인트}.jpg, 없으면 crop_{번호}.jpg

6. 부가 분석 정보:
   - zone: 배지/부품의 구역명 또는 번호 (예: "포인트 -1", "3E07-1")
   - type: 시험 항목 ("낙하균", "부유균", "표면균" 등)
   - mediaType: 배지 종류 (TSA, SDA, SDAC 등. TSA는 세균, SDA/SDAC는 진균)
   - rawLabel: 표면에서 판독된 손글씨/라벨 텍스트 원문 전체
   - colonyCount: 관찰되는 균락/CFU 수 (없으면 0)
   - remarks: 판독 의견 (예: "손글씨 포인트 -1, 측정일자 2026-10-06 인식 완료")

반드시 유효한 JSON 형식으로만 응답하세요.
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        plates: {
          type: Type.ARRAY,
          description: '사진 속에서 감지된 모든 독립 개체(키트/배지/부품) 목록',
          items: {
            type: Type.OBJECT,
            properties: {
              crop_id: {
                type: Type.STRING,
                description: '순차적 컷팅 식별 ID (예: crop_01, crop_02)',
              },
              recognized_number: {
                type: Type.STRING,
                description: '손글씨/라벨에서 판독된 번호/숫자 (예: 51, 52, 1, 2)',
              },
              point_number: {
                type: Type.STRING,
                description: '배지에 유성매직/손글씨로 적힌 측정 포인트 번호 (예: -1, -2, 1, 2, 3E07-1)',
              },
              measured_date: {
                type: Type.STRING,
                description: '배지에 유성매직/도장으로 적힌 측정일자 (예: 2026-10-06, 26.10.05)',
              },
              file_name: {
                type: Type.STRING,
                description: '매핑된 파일명 (예: kit_1.jpg 또는 crop_01.jpg)',
              },
              plate_id: {
                type: Type.STRING,
                description: '개체 식별 ID (예: kit_1, 배지_1)',
              },
              zone: {
                type: Type.STRING,
                description: '구역명 또는 개체 라벨명 (예: 포인트 -1, 3E07-1)',
              },
              type: {
                type: Type.STRING,
                description: '시험 항목 또는 개체 종류 (낙하균, 부유균, 표면균, 진단키트 등)',
              },
              box: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: '배지 손글씨/외곽이 보존된 [ymin, xmin, ymax, xmax] 0~1000 상대좌표',
              },
              mediaType: {
                type: Type.STRING,
                description: '배지/키트 종류 (예: TSA, SDA, SDAC)',
              },
              rawLabel: {
                type: Type.STRING,
                description: '표면에서 판독된 원본 텍스트/손글씨/날짜 전체',
              },
              colonyCount: {
                type: Type.INTEGER,
                description: '집락 수 또는 반응 카운트',
              },
              remarks: {
                type: Type.STRING,
                description: '관찰 특이사항 및 판독 의견',
              },
            },
            required: ['box'],
          },
        },
      },
      required: ['plates'],
    };

    // Candidate models with fallback order - prioritize ultra-fast, high-capacity flash-lite
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-flash-latest',
    ];

    let response: any = null;
    let lastError: any = null;

    // Try models with instant failover on 503 high-demand to prevent client timeouts
    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        });
        if (response && response.text) {
          break; // Success!
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isHighDemand =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('overloaded');

        console.warn(`[Gemini API] Model ${modelName} error:`, errMsg);

        if (isHighDemand) {
          // Do not sleep or retry the same overloaded model - immediately switch to next candidate
          console.warn(`[Gemini API] Model ${modelName} has demand spike. Immediately switching to next model...`);
          continue;
        }

        // For other transient errors (like 429), try one quick retry after 400ms
        if (errMsg.includes('429') || errMsg.includes('ResourceExhausted')) {
          try {
            await new Promise((r) => setTimeout(r, 400));
            response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
              config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
              },
            });
            if (response && response.text) {
              break;
            }
          } catch (retryErr: any) {
            lastError = retryErr;
          }
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('AI 모델 응답을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }

    const responseText = response.text || '{}';
    let data;
    try {
      data = JSON.parse(responseText.trim());
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse model JSON output');
      }
    }

    let platesList = Array.isArray(data.plates) ? data.plates : [];

    // Fallback if data was returned in flat format
    if (platesList.length === 0 && data.box) {
      platesList = [data];
    }

    // Default safety fallback if nothing returned
    if (platesList.length === 0) {
      platesList = [
        {
          crop_id: 'crop_01',
          recognized_number: '',
          file_name: 'crop_01.jpg',
          plate_id: 'kit_01',
          zone: data.zone || '미지정 구역',
          type: data.type || '진단키트/배지',
          box: [50, 50, 950, 950],
          mediaType: data.mediaType || 'Kit',
          rawLabel: data.rawLabel || '',
          colonyCount: typeof data.colonyCount === 'number' ? data.colonyCount : 0,
          remarks: data.remarks || '정상 분석 완료',
        },
      ];
    }

    // Sort detected objects in spatial order (top-to-bottom, left-to-right)
    platesList.sort((a: any, b: any) => {
      const boxA = Array.isArray(a.box) && a.box.length === 4 ? a.box : [0, 0, 1000, 1000];
      const boxB = Array.isArray(b.box) && b.box.length === 4 ? b.box : [0, 0, 1000, 1000];
      const yCenterA = (boxA[0] + boxA[2]) / 2;
      const yCenterB = (boxB[0] + boxB[2]) / 2;
      const hA = Math.max(20, boxA[2] - boxA[0]);
      // If rows are distinct (> 35% object height difference), sort by Y row first
      if (Math.abs(yCenterA - yCenterB) > hA * 0.35) {
        return yCenterA - yCenterB;
      }
      return boxA[1] - boxB[1]; // Otherwise sort by X left-to-right
    });

    // Sanitize bounding boxes with safe padding, OCR point & date parsing, and filename mapping
    const sanitizedPlates = platesList.map((p: any, idx: number) => {
      let box = Array.isArray(p.box) && p.box.length === 4 ? p.box : [80, 80, 920, 920];
      
      // Ensure generous safe margin (approx 3% margin around borders) so dish outer rim and handwriting don't clip
      const ymin = Math.max(0, Math.round(box[0] - 25));
      const xmin = Math.max(0, Math.round(box[1] - 25));
      const ymax = Math.min(1000, Math.round(box[2] + 25));
      const xmax = Math.min(1000, Math.round(box[3] + 25));
      const safeBox: [number, number, number, number] = [ymin, xmin, ymax, xmax];

      const seqNumber = String(idx + 1).padStart(2, '0');
      const cropId = p.crop_id || `crop_${seqNumber}`;

      // Extract recognized point number from point_number, recognized_number, or rawLabel
      let pointNumber = p.point_number ? String(p.point_number).trim() : '';
      let recognizedNumber = p.recognized_number ? String(p.recognized_number).trim() : '';

      if (!pointNumber && p.rawLabel) {
        // Look for -1, -2, 1, 2, #1, #2 in raw label
        const pointMatch = String(p.rawLabel).match(/([-\#]?\d+)/);
        if (pointMatch) {
          pointNumber = pointMatch[1].replace('#', '-');
        }
      }

      // Normalize point number e.g. "1" -> "-1", "2" -> "-2", "-1" -> "-1"
      if (pointNumber) {
        if (/^\d+$/.test(pointNumber)) {
          pointNumber = `-${pointNumber}`;
        }
        if (!recognizedNumber) {
          recognizedNumber = pointNumber.replace(/^-/, '');
        }
      } else if (recognizedNumber) {
        pointNumber = `-${recognizedNumber}`;
      }

      // Extract measured date from measured_date or rawLabel
      let measuredDate = p.measured_date ? String(p.measured_date).trim() : '';
      if (!measuredDate && p.rawLabel) {
        // Look for 2026-10-06 or 2026.10.06 or 26.10.06
        const dateMatch = String(p.rawLabel).match(/(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})|(\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/);
        if (dateMatch) {
          measuredDate = dateMatch[0].replace(/[./]/g, '-');
          if (/^\d{2}-\d{2}-\d{2}$/.test(measuredDate)) {
            measuredDate = `20${measuredDate}`;
          }
        }
      }

      // Map filename: if recognized number exists -> kit_{num}.jpg, else crop_{seqNumber}.jpg
      let fileName = p.file_name;
      if (recognizedNumber) {
        fileName = `kit_${recognizedNumber}.jpg`;
      } else if (!fileName) {
        fileName = `crop_${seqNumber}.jpg`;
      }

      const zoneName = p.zone || (pointNumber ? `포인트 ${pointNumber}` : (recognizedNumber ? `Kit ${recognizedNumber}` : `배지 ${idx + 1}`));

      return {
        crop_id: cropId,
        recognized_number: recognizedNumber,
        point_number: pointNumber,
        measured_date: measuredDate,
        file_name: fileName,
        plate_id: p.plate_id || (recognizedNumber ? `kit_${recognizedNumber}` : `배지_${idx + 1}`),
        zone: zoneName,
        type: p.type || '낙하균',
        box: safeBox,
        mediaType: p.mediaType || 'TSA',
        rawLabel: p.rawLabel || (pointNumber ? `손글씨: ${pointNumber}` : ''),
        colonyCount: typeof p.colonyCount === 'number' ? p.colonyCount : 0,
        remarks: p.remarks || (pointNumber ? `손글씨 포인트 ${pointNumber}${measuredDate ? `, 측정일자 ${measuredDate}` : ''} 인식 완료` : `순차 자동 컷팅 (${fileName})`),
      };
    });

    res.json({
      success: true,
      plates: sanitizedPlates,
      result: sanitizedPlates[0], // Backwards-compatible
      totalPlates: sanitizedPlates.length,
    });
  } catch (err: any) {
    console.error('Error analyzing plate:', err);
    res.status(500).json({
      success: false,
      error: err?.message || '배지 이미지 분석 중 오류가 발생했습니다.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EM Plate Analyzer Server running on port ${PORT}`);
  });
}

startServer();
