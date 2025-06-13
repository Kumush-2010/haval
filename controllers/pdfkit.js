const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
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

        const { model, color, engine, payment, price, userId } = requestBody;

        if (!model || !color || !engine || !payment || !price || !userId) {
            return res.status(400).json({ error: "Barcha maydonlar to‘ldirilishi kerak." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
        }

        // Foydalanuvchidan ma'lumotlarni olish
        const fullname = user.name || user.fullname || "Ismsiz foydalanuvchi";
        const address = user.address || "Urganch shahri, Amir Temur ko‘chasi, 10A";
        // const hr = user.hr || "Ko‘rsatilmagan";
        // const mfo = user.mfo || "Ko‘rsatilmagan";
        // const inn = user.inn || "Ko‘rsatilmagan";
        const representative = user.representative || "Ko‘rsatilmagan";

        const bucketName = process.env.SUPABASE_BUCKET_NAME;
        if (!bucketName) {
            return res.status(500).json({ error: "Supabase bucket nomi topilmadi!" });
        }

        let lastNumber = 0; 
        const lastPdf = await PDF.findOne().sort({ number: -1 }).lean();
            if (lastPdf && Number.isInteger(lastPdf.number)) {
                 lastNumber = lastPdf.number;
             }
        const newNumber = lastNumber + 1;

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const drawText = (text, x, y, size = 12) =>
            page.drawText(text, { x, y, size, font });


        const today = new Date();
const day = String(today.getDate()).padStart(2, '0');
const month = String(today.getMonth() + 1).padStart(2, '0'); // 0-based
const year = today.getFullYear();
        // PDF matn
        drawText(`LIMON-AVTO AVTOMOBIL SOTIB OLISH SHARTNOMA No. ${newNumber}`, 50, 750, 14);
        drawText(`"${day}"  ${month}.${year} yil`, 400, 730);
        drawText(`Biz, kim quyida imzo chekib, o‘zaro shartnoma tuzuvchilar bir tomondan "Limon Avto" MChJ nomidan`, 50, 710);
        drawText(`harakat qiluvchi Sotuvchi, va ikkinchi tomondan, xaridor ${fullname} quyidagi`, 50, 690);
        drawText(` shartlarga ko‘ra`, 50, 670);
        drawText(`ushbu shartnomani tuzdilar:`, 50, 655);

        drawText(`1. Shartnoma mavzusi`, 50, 630, 13);
        drawText(`1.1. Sotuvchi quyidagi avtomobilni Xaridorga sotadi:`, 50, 615);
        drawText(`Avtomobil nomi: ${model}`, 50, 595);
        drawText(`Rangi: ${color}`, 50, 580);
        drawText(`Dvigatel: ${engine}`, 50, 565);
        drawText(`Miqdori: 1 dona`, 50, 535);
        drawText(`Narxi (so‘mda): ${price}`, 50, 520);
        drawText(`Umumiy qiymat: ${price}`, 50, 505);

        drawText(`2. Avtomobilni topshirish va to‘lov tartibi`, 50, 480, 13);
        drawText(`2.1 Xaridor shartnoma imzolanganidan so‘ng 3 ish kuni ichida to‘lovni amalga oshiradi.`, 50, 465);
        drawText(`2.2 Sotuvchi to‘lovdan so‘ng avtomobilni yetkazib beradi yoki joyida topshiradi.`, 50, 450);
        drawText(`2.3 Texnik holat va hujjatlar Xaridor tomonidan qabul qilinadi.`, 50, 435);

        drawText(`3. Tomonlarning majburiyatlari`, 50, 410, 13);
        drawText(`3.1 Sotuvchi avtomobilni ishlash holatida topshiradi.`, 50, 395);
        drawText(`3.2 Xaridor belgilangan muddatda to‘lovni amalga oshiradi.`, 50, 380);
        drawText(`3.3 Qabuldan keyin texnik holat bo‘yicha da’volar qabul qilinmaydi.`, 50, 365);

        drawText(`4. Tomonlarning rekvizitlari va imzolari`, 50, 340, 13);

        // Sotuvchi
        drawText(`Sotuvchi:`, 50, 320);
        drawText(`Korxona nomi: Limon Avto MChJ`, 50, 305);
        drawText(`Manzil: Urganch shahri, Mustaqillik ko‘chasi, 7-uy`, 50, 290);
        // drawText(`H/r: 20208000300123456789`, 50, 275);
        // drawText(`MFO: 01180`, 50, 260);
        // drawText(`INN: 305123456`, 50, 245);
        drawText(`Rahbar: Akmal Shakirov`, 50, 275);
        drawText(`Imzo: __________________________`, 50, 245);

        // Xaridor
        drawText(`Xaridor:`, 300, 320);
        drawText(`F.I.Sh: ${fullname}`, 300, 305);
        drawText(`Manzil: ${address}`, 300, 290);
        // drawText(`H/r: ${hr}`, 300, 275);
        // drawText(`MFO: ${mfo}`, 300, 260);
        // drawText(`INN: ${inn}`, 300, 245);
        drawText(`Vakili: ${representative}`, 300, 275);
        drawText(`Imzo: __________________________`, 300, 245);

        // Faylni saqlash
        const pdfBytes = await pdfDoc.save();
        const folderPath = path.join(__dirname, "../pdfs");
        await fsPromises.mkdir(folderPath, { recursive: true });

        const filename = `${Date.now()}-${uuidv4()}.pdf`;
        const filePath = path.join(folderPath, filename);
        await fsPromises.writeFile(filePath, pdfBytes);
        const fileBuffer = await fsPromises.readFile(filePath);

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(`pdfs/${filename}`, fileBuffer, {
                cacheControl: "3600",
                upsert: false,
                contentType: "application/pdf"
            });

        if (error) throw error;

        const { data: urlData } = await supabase.storage
            .from(bucketName)
            .getPublicUrl(`pdfs/${filename}`);

        if (!urlData?.publicUrl) {
            return res.status(500).json({ error: "Supabase URL yaratishda xatolik!" });
        }

        const newPdf = await PDF.create({
            userId,
            number: newNumber,
            filename,
            url: urlData.publicUrl,
            fullname,
            model,
            color,
            engine,
            payment,
            price,
            address,
            // hr,
            // mfo,
            // inn,
            representative
        });

        await User.findByIdAndUpdate(userId, {
            $push: { orders: newPdf.id }
        });

        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Faylni o‘chirishda xatolik: ${err.message}`);
            });
        }, 15000);

        return res.status(201).json({ Pdf: newPdf });

    } catch (error) {
        console.error("Xatolik:", error);
        return res.status(500).json({ error: "PDF yaratishda xatolik yuz berdi." });
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
