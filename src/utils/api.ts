import type { QuizQuestion } from '../types';

export function extractJson<T>(text: string): T | null {
  try {
    const lines = text.trim().split('\n');

    // Check and remove ```json or ``` on first/last line
    if (/^```(?:json)?\s*$/i.test(lines[0])) lines.shift();
    if (/^\s*```$/.test(lines[lines.length - 1])) lines.pop();

    const cleaned = lines.join('\n').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('❌ Failed to parse AI response as JSON:', e);
    console.error('🧾 Raw response:', text);
    return null;
  }
}

export async function uploadToGeminiAndGenerateQuiz(fileContent: string): Promise<string> {
  const prompt = `
Bạn là một giáo viên đại học kỳ cựu, chuyên ra đề thi khó và đánh đố sinh viên. Tôi sẽ cung cấp cho bạn một file tài liệu (slide PDF hoặc text), bạn hãy:

    Đọc kỹ nội dung trong file, chia nó thành các phần hoặc chủ đề chính.

    Dựa trên toàn bộ nội dung, tạo ra CHÍNH XÁC 30 câu hỏi trắc nghiệm.

Yêu cầu:

    Câu hỏi phải bao quát các chủ đề chính, không bị trùng lặp nội dung.

    Ưu tiên các phần khó, dễ gây nhầm lẫn hoặc sinh viên thường sai.

    Nếu trong slide có đề cập đến tài liệu hoặc link ngoài, hãy đọc nội dung liên quan và tạo câu hỏi từ đó. Tuy nhiên, chỉ hỏi những gì liên quan đến bài giảng – không hỏi những chi tiết vô nghĩa như ai viết trang đó hay tên trang web.

    Nội dung câu hỏi không nên đề cập đến ngữ cảnh của slide, nếu cần gắn với ngữ cảnh thì hãy mô tả kèm theo ngữ cảnh đó (ví dụ "Dựa vào mô hình ở slide x" thì thay bằng "Dựa vào mô hình ABC"). Bỏ qua các nội dung không liên quan đến nội dung bài học như cách tính điểm hay thời lượng lên lớp.

    Mỗi câu hỏi phải có từ 3 đến 6 đáp án. Có thể có nhiều đáp án đúng. Số đáp án đúng phải ít hơn số đáp án.

    Nội dung các đáp án khác nhau nên có độ dài và từ vựng gần giống nhau để dễ gây nhầm lẫn, tránh việc cho 1 đáp án dài hơn hẳn hoặc quá rõ ràng để dễ dàng lựa chọn.

    Mỗi đáp án cần có giải thích rõ ràng, bắt đầu bằng "ĐÚNG, vì..." nếu đúng, hoặc "SAI, vì..." nếu sai.
Khi tạo phần giải thích, hãy viết lại nội dung dưới dạng kiến thức tổng quát, không phụ thuộc vào cách trình bày trong tài liệu. Mục tiêu là để sinh viên hiểu khái niệm, không phải nhớ vị trí xuất hiện của nó.
Quan trọng – Cấm tuyệt đối:
Không được nhắc đến vị trí nội dung trong tài liệu như: slide số bao nhiêu, mục số mấy, trang bao nhiêu, phần đầu/cuối/m giữa, hay tiêu đề slide, v.v.


Câu hỏi và phần giải thích phải độc lập với bố cục tài liệu gốc – chỉ dựa vào nội dung học thuật được trình bày.


Nếu bạn không thể viết giải thích mà không nhắc đến “slide”, “mục”, “phần”, v.v., thì bạn đang làm sai yêu cầu.


Kết quả đầu ra cần đúng theo định dạng JSON như sau:

[
  {
    "statement": "Câu hỏi?",
    "answer": [
      {
        "correct": true,
        "content": "Đáp án A",
        "explanation": "ĐÚNG, vì ..."
      },
      {
        "correct": false,
        "content": "Đáp án B",
        "explanation": "SAI, vì ..."
      }
    ]
  }
]

Chỉ cần trả về JSON, không cần giải thích gì thêm.

Here is the content:

\`\`\`
${fileContent}
\`\`\`
`;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing Gemini API key in .env (VITE_GEMINI_API_KEY)');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await res.json();
  const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!aiText) throw new Error('Gemini returned an empty response');

  return aiText;
}

