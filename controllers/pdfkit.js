const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { supabase } = require("../config/supabaseClient");
const PDF = require("../models/Order");
const User = require("../models/User");

exports.generate_pdf = async (req, res) => {
    try {
        let requestBody;
        if (typeof req.body.body === "string") {
            requestBody = JSON.parse(req.body.body);
        } else {
            requestBody = req.body;
        }

        const {
            fullname,
            // phone,
            model,
            color,
            engine,
            transmission,
            payment,
            price,
            userId,
        } = requestBody;

        const lastPdf = await PDF.findOne().sort({ number: -1 });
        let lastNumber = lastPdf?.number ?? 0;
        lastNumber = Number.isInteger(Number(lastNumber)) ? Number(lastNumber) : 0;
        const newNumber = lastNumber + 1;

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const drawText = (text, x, y, size = 12) =>
            page.drawText(text, { x, y, size, font });

        // Header
        drawText(`LIMON-AVTO AVTOMOBIL SOTIB OLISH SHARTNOMA № ${newNumber}`, 50, 750, 14);
        drawText(`_______ shahri`, 50, 730);
        drawText(`"__" __________ 20__ yil`, 400, 730);

        // Introduction
        drawText(`Biz, kim quyida imzo chekib, o‘zaro shartnoma tuzuvchilar bir tomondan`, 50, 710);
        drawText(`"Limon Avto" MChJ nomidan harakat qiluvchi Sotuvchi,`, 50, 690);
        drawText(`va ikkinchi tomondan, xaridor ${fullname} quyidagi shartlarga ko‘ra`, 50, 670);
        drawText(`ushbu shartnomani tuzdilar:`, 50, 655);

        // Section 1
        drawText(`1. Shartnoma mavzusi`, 50, 630, 13);
        drawText(`1.1. Sotuvchi quyidagi avtomobilni Xaridorga sotadi:`, 50, 615);

        // Table-like section
        drawText(`Avtomobil nomi: ${model}`, 50, 595);
        drawText(`Rangi: ${color}`, 50, 580);
        drawText(`Dvigatel: ${engine}`, 50, 565);
        drawText(`Transmissiya: ${transmission}`, 50, 550);
        drawText(`Miqdori: 1 dona`, 50, 535);
        drawText(`Narxi (so‘mda): ${price}`, 50, 520);
        drawText(`Umumiy qiymat: ${price}`, 50, 505);

        // Section 2
        drawText(`2. Avtomobilni topshirish va to‘lov tartibi`, 50, 480, 13);
        drawText(`2.1 Xaridor shartnoma imzolanganidan so‘ng ___ ish kuni ichida to‘lovni amalga oshiradi.`, 50, 465);
        drawText(`2.2 Sotuvchi to‘lovdan so‘ng avtomobilni yetkazib beradi yoki joyida topshiradi.`, 50, 450);
        drawText(`2.3 Texnik holat va hujjatlar Xaridor tomonidan qabul qilinadi.`, 50, 435);

        // Section 3
        drawText(`3. Tomonlarning majburiyatlari`, 50, 410, 13);
        drawText(`3.1 Sotuvchi avtomobilni ishlash holatida topshiradi.`, 50, 395);
        drawText(`3.2 Xaridor belgilangan muddatda to‘lovni amalga oshiradi.`, 50, 380);
        drawText(`3.3 Qabuldan keyin texnik holat bo‘yicha da’volar qabul qilinmaydi.`, 50, 365);

        // Section 4
        drawText(`4. Tomonlarning rekvizitlari va imzolari`, 50, 340, 13);
        drawText(`Sotuvchi:`, 50, 320);
        drawText(`Korxona nomi: Limon Avto MChJ`, 50, 305);
        drawText(`Manzil: _________________________`, 50, 290);
        drawText(`H/r: ____________________________`, 50, 275);
        drawText(`MFO: ___________________________`, 50, 260);
        drawText(`INN: ___________________________`, 50, 245);
        drawText(`Rahbar: ________________________`, 50, 230);
        drawText(`Imzo: __________________________`, 50, 215);

        drawText(`Xaridor:`, 300, 320);
        drawText(`F.I.Sh: ${fullname}`, 300, 305);
        drawText(`Manzil: _________________________`, 300, 290);
        // drawText(`Tel: ${phone}`, 300, 275);
        drawText(`H/r: ____________________________`, 300, 260);
        drawText(`MFO: ___________________________`, 300, 245);
        drawText(`INN: ___________________________`, 300, 230);
        drawText(`Vakili: _________________________`, 300, 215);
        drawText(`Imzo: __________________________`, 300, 200);

        const pdfBytes = await pdfDoc.save();

        const folderPath = path.join(__dirname, "../pdfs");
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const filename = `${Date.now()}.pdf`;
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, pdfBytes);

        const { data, error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET_NAME)
            .upload(`pdfs/${filename}`, fs.createReadStream(filePath), {
                cacheControl: "3600",
                upsert: false,
                contentType: "application/pdf",
                duplex: "half",
            });

        if (error) throw error;

        const { data: urlData } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET_NAME)
            .getPublicUrl(`pdfs/${filename}`);

        if (!urlData.publicUrl) {
            return res.status(500).json({ error: "Supabase URL yaratishda xatolik!" });
        }

        const newPdf = await PDF.create({
            userId,
            number: newNumber,
            filename,
            url: urlData.publicUrl,
            fullname,
            // phone,
            model,
            color,
            engine,
            transmission,
            payment,
            price
        });

        await User.findByIdAndUpdate(userId, {
            $push: { orders: newPdf.id }
        });

        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Faylni o‘chirishda xatolik: ${err.message}`);
                });
            }
        }, 15000);

        return res.status(201).json({ Pdf: newPdf });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "PDF yaratishda xatolik yuz berdi." });
    }
};


exports.download_pdf = async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename) {
            return res.status(400).json({ error: "Fayl nomi kiritilmagan" });
        }

        const { data } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET_NAME)
            .getPublicUrl(`pdfs/${filename}`);

        if (!data) {
            return res.status(404).json({ error: "Bunday fayl topilmadi" });
        }

        res.json({ url: data.publicUrl });
    } catch (error) {
        console.error("Server xatosi:", error);
        res.status(500).json({ error: "PDF yuklab olishda xatolik yuz berdi" });
    }
};
