const dom = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("file-input"),
    fileCard: document.getElementById("file-card"),
    fileName: document.getElementById("file-name"),
    fileSize: document.getElementById("file-size"),
    removeFile: document.getElementById("remove-file"),
    convertBtn: document.getElementById("convert-btn"),
    downloadBtn: document.getElementById("download-btn"),
    progressBar: document.getElementById("progress-bar"),
    progressLabel: document.getElementById("progress-label"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text")
};

let selectedFile = null;
let convertTimer = null;
let progressValue = 0;
let outputBlob = null;
let outputFilename = null;

function showToast(message) {
    dom.toastText.textContent = message;
    dom.toast.classList.remove("hidden");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => dom.toast.classList.add("hidden"), 2400);
}

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    const rounded = idx === 0 ? String(Math.round(value)) : value.toFixed(1);
    return `${rounded} ${units[idx]}`;
}

function setProgress(value) {
    const v = Math.max(0, Math.min(100, value));
    progressValue = v;
    dom.progressLabel.textContent = `${v}%`;
    dom.progressBar.style.width = `${v}%`;
}

function resetUI() {
    selectedFile = null;
    outputBlob = null;
    outputFilename = null;
    dom.fileInput.value = "";
    dom.fileCard.classList.add("hidden");
    dom.downloadBtn.classList.add("hidden");
    dom.convertBtn.disabled = false;
    dom.convertBtn.classList.remove("opacity-60", "cursor-not-allowed");
    dom.convertBtn.querySelector("span")?.remove?.();
    setProgress(0);
    window.clearInterval(convertTimer);
    convertTimer = null;
}

function acceptFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        showToast("Please upload a PDF file.");
        return;
    }
    if (file.size > 25 * 1024 * 1024) {
        showToast("File is large. Recommended maximum is 25 MB.");
    }
    selectedFile = file;
    outputBlob = null;
    outputFilename = null;
    dom.fileName.textContent = file.name;
    dom.fileSize.innerHTML = `
        <i data-lucide="hard-drive" class="w-4 h-4"></i>
        ${formatBytes(file.size)}
    `;
    dom.fileCard.classList.remove("hidden");
    dom.downloadBtn.classList.add("hidden");
    setProgress(0);
    lucide.createIcons();
}

function escapeXml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function crc32(bytes) {
    let crc = 0 ^ -1;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = (crc >>> 8) ^ crc32.table[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
}

crc32.table = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function u16le(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32le(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concatBytes(chunks) {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
    }
    return out;
}

function dosDateTime(date) {
    const d = new Date(date);
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2) & 31) << 0);
    const dosDate = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | ((d.getDate() & 31) << 0);
    return { time, date: dosDate };
}

function zipStore(entries, mtime) {
    const encoder = new TextEncoder();
    const central = [];
    const locals = [];
    let offset = 0;
    const dt = dosDateTime(mtime || Date.now());

    for (const e of entries) {
        const nameBytes = encoder.encode(e.name);
        const data = e.data;
        const crc = crc32(data);
        const localHeader = concatBytes([
            u32le(0x04034b50),
            u16le(20),
            u16le(0),
            u16le(0),
            u16le(dt.time),
            u16le(dt.date),
            u32le(crc),
            u32le(data.length),
            u32le(data.length),
            u16le(nameBytes.length),
            u16le(0),
            nameBytes
        ]);

        locals.push(localHeader, data);

        const centralHeader = concatBytes([
            u32le(0x02014b50),
            u16le(20),
            u16le(20),
            u16le(0),
            u16le(0),
            u16le(dt.time),
            u16le(dt.date),
            u32le(crc),
            u32le(data.length),
            u32le(data.length),
            u16le(nameBytes.length),
            u16le(0),
            u16le(0),
            u16le(0),
            u16le(0),
            u32le(0),
            u32le(offset),
            nameBytes
        ]);
        central.push(centralHeader);

        offset += localHeader.length + data.length;
    }

    const centralData = concatBytes(central);
    const eocd = concatBytes([
        u32le(0x06054b50),
        u16le(0),
        u16le(0),
        u16le(entries.length),
        u16le(entries.length),
        u32le(centralData.length),
        u32le(offset),
        u16le(0)
    ]);

    return concatBytes([...locals, centralData, eocd]);
}

function buildDocx(lines) {
    const encoder = new TextEncoder();

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `</Relationships>`;

    const paragraphs = (lines || []).map(t => {
        const safe = escapeXml(t);
        return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }).join("");

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:body>${paragraphs}<w:sectPr/></w:body>` +
        `</w:document>`;

    const zipBytes = zipStore(
        [
            { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
            { name: "_rels/.rels", data: encoder.encode(rels) },
            { name: "word/document.xml", data: encoder.encode(documentXml) }
        ],
        Date.now()
    );

    return new Blob([zipBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

function getPdfjs() {
    return window.pdfjsLib || null;
}

function getDocx() {
    return window.docx || null;
}

async function convertPdfToDocxBlob(file) {
    const pdfjsLib = getPdfjs();
    const docx = getDocx();
    if (!pdfjsLib || !docx) {
        const blob = buildDocx([
            "InnoGen Portal Hub",
            "PDF Convert to Word (Fallback Output)",
            "",
            "Conversion libraries are not available.",
            "Please check your network access to the required CDNs or host the libraries internally.",
            "",
            `Source file: ${file.name}`,
            `Generated at: ${new Date().toLocaleString()}`
        ]);
        return { blob, usedFallback: true };
    }

    const preserveSpacesForWord = (text) => {
        let out = "";
        let run = 0;
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            if (ch === " ") {
                run += 1;
                out += run === 1 ? " " : "\u00A0";
            } else {
                run = 0;
                out += ch;
            }
        }
        return out;
    };

    const extractLinesFromTextItems = (items) => {
        const sorted = items
            .filter(it => it && it.text && it.text.trim().length)
            .sort((a, b) => (b.y - a.y) || (a.x - b.x));

        const lines = [];
        let current = null;

        for (const it of sorted) {
            const fontSize = it.fontSize || 10;
            const lineThreshold = Math.max(4, fontSize * 0.9);

            if (!current) {
                current = { y: it.y, items: [it], fontSize };
                continue;
            }

            const dy = Math.abs(it.y - current.y);
            if (dy > lineThreshold) {
                lines.push(current);
                current = { y: it.y, items: [it], fontSize };
            } else {
                current.items.push(it);
                current.y = (current.y + it.y) / 2;
                current.fontSize = Math.max(current.fontSize, fontSize);
            }
        }

        if (current) lines.push(current);

        for (const line of lines) {
            line.items.sort((a, b) => a.x - b.x);
        }

        return lines;
    };

    const composeLineText = (line) => {
        let text = "";
        let prevEndX = null;
        let avgSpaceUnit = Math.max(2, (line.fontSize || 10) * 0.25);

        for (const it of line.items) {
            const str = it.text;
            const x = it.x;
            const width = it.width || (str.length * ((it.fontSize || line.fontSize || 10) * 0.45));

            if (prevEndX !== null) {
                const gap = x - prevEndX;
                if (gap > avgSpaceUnit * 12) {
                    text += "\t";
                } else if (gap > avgSpaceUnit * 1.2) {
                    const spaces = Math.min(80, Math.max(1, Math.round(gap / avgSpaceUnit)));
                    text += " ".repeat(spaces);
                } else {
                    text += " ";
                }
            }

            text += str;

            const charWidth = width / Math.max(1, str.length);
            avgSpaceUnit = Math.max(2, Math.min(avgSpaceUnit * 1.1, charWidth));
            prevEndX = x + width;
        }

        return text.replaceAll("\u0000", "").trimEnd();
    };

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const paragraphs = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent({ includeMarkedContent: true });
        const mapped = (textContent.items || []).map(item => {
            const t = item?.transform || [];
            const a = typeof t[0] === "number" ? t[0] : 0;
            const d = typeof t[3] === "number" ? t[3] : 0;
            const fontSize = Math.max(1, Math.abs(d || a || 10));
            return {
                text: item?.str || "",
                x: typeof t[4] === "number" ? t[4] : 0,
                y: typeof t[5] === "number" ? t[5] : 0,
                width: typeof item?.width === "number" ? item.width : null,
                fontSize
            };
        });

        const lines = extractLinesFromTextItems(mapped);
        if (i > 1) paragraphs.push(new docx.Paragraph({ text: "" }));

        if (lines.length === 0) {
            paragraphs.push(new docx.Paragraph({ text: "(No selectable text found on this page.)" }));
        } else {
            let prevY = null;
            for (const line of lines) {
                if (prevY !== null) {
                    const gap = Math.abs(prevY - line.y);
                    if (gap > Math.max(14, line.fontSize * 2)) {
                        paragraphs.push(new docx.Paragraph({ text: "" }));
                    }
                }

                const lineText = composeLineText(line);
                paragraphs.push(
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: preserveSpacesForWord(lineText || " ")
                            })
                        ],
                        spacing: { after: 0, before: 0 }
                    })
                );
                prevY = line.y;
            }
        }

        const percent = Math.round((i / pdf.numPages) * 100);
        setProgress(percent);
    }

    const document = new docx.Document({
        sections: [
            {
                properties: {},
                children: paragraphs
            }
        ]
    });

    const blob = await docx.Packer.toBlob(document);
    return { blob, usedFallback: false };
}

async function startConversion() {
    if (!selectedFile) {
        showToast("Upload a PDF first.");
        return;
    }

    dom.convertBtn.disabled = true;
    dom.convertBtn.classList.add("opacity-60", "cursor-not-allowed");
    dom.downloadBtn.classList.add("hidden");
    setProgress(0);

    try {
        const base = selectedFile.name.replace(/\.pdf$/i, "");
        outputFilename = `${base}.docx`;
        const result = await convertPdfToDocxBlob(selectedFile);
        outputBlob = result.blob;
        dom.downloadBtn.classList.remove("hidden");
        if (result.usedFallback) showToast("Converted with fallback output. Check CDN availability for full conversion.");
        else showToast("Conversion complete. Download the DOCX.");
    } catch (e) {
        outputBlob = null;
        outputFilename = null;
        setProgress(0);
        showToast("Conversion failed. Try another PDF or check console for details.");
        console.error(e);
    } finally {
        dom.convertBtn.disabled = false;
        dom.convertBtn.classList.remove("opacity-60", "cursor-not-allowed");
    }
}

function downloadDocx() {
    if (!outputBlob || !outputFilename) {
        showToast("No converted document available yet.");
        return;
    }
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function setDragActive(active) {
    if (active) dom.dropzone.classList.add("dropzone-dragover");
    else dom.dropzone.classList.remove("dropzone-dragover");
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    const pdfjsLib = getPdfjs();
    if (pdfjsLib?.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    dom.dropzone.addEventListener("dragenter", (e) => {
        e.preventDefault();
        setDragActive(true);
    });
    dom.dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        setDragActive(true);
    });
    dom.dropzone.addEventListener("dragleave", () => setDragActive(false));
    dom.dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer?.files?.[0] || null;
        acceptFile(file);
    });

    dom.fileInput.addEventListener("change", (e) => {
        const input = e.target;
        const file = input.files?.[0] || null;
        acceptFile(file);
    });

    dom.removeFile.addEventListener("click", () => resetUI());
    dom.convertBtn.addEventListener("click", () => startConversion());
    dom.downloadBtn.addEventListener("click", () => downloadDocx());

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") resetUI();
    });
});
