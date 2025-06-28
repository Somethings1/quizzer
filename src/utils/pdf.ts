import * as pdfjsLib from 'pdfjs-dist';

// This is where the real magic happens:
pdfjsLib.GlobalWorkerOptions.workerSrc = `/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`;

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(' ') + '\n\n';
  }
  return fullText;
};

