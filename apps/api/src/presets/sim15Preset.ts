export type Sim15Preset = {
    sessionNames: string[];
    scriptText: string;
    automationDefaults: {
        timezone: string;
        windowStart: string;
        windowEnd: string;
        messagesPerSession: number;
        dailyLimitPerSession: number;
    };
};

export const SIM15_PRESET: Sim15Preset = {
    sessionNames: [
        'sim-1', 'sim-2', 'sim-3', 'sim-4', 'sim-5',
        'sim-6', 'sim-7', 'sim-8', 'sim-9', 'sim-10',
        'sim-11', 'sim-12', 'sim-13', 'sim-14', 'sim-15',
    ],
    scriptText: `Eh, kamu akhir-akhir ini sibuk nggak?
Lumayan, tapi masih bisa santai.
Kerjaannya lagi banyak?
Iya, tapi pelan-pelan dikejar.
Yang penting nggak stres ya.
Betul, jaga ritme.
Kamu biasanya ngilangin capek gimana?
Denger musik atau jalan sebentar.
Musik genre apa?
Pop santai atau acoustic.
Aku juga suka yang begitu.
Bikin pikiran adem.
Kadang playlist bisa ngaruh banget.
Iya, mood langsung naik.
Kalau pagi kamu lebih suka hening atau musik?
Lebih ke hening dulu.
Biar fokus ya.
Iya, baru nyala pelan.
Ngomong-ngomong sarapan tadi apa?
Roti sama kopi.
Simple tapi cukup.
Yang penting ngisi energi.
Kamu?
Nasi dan telur.
Klasik tapi aman.
Hehe betul.
Siang nanti rencana makan apa?
Belum tau, lihat nanti.
Kadang spontan lebih enak.
Setuju sih.
Eh, kamu lebih suka kerja pagi atau malam?
Pagi.
Aku justru malam.
Menarik juga bedanya.
Yang penting produktif.
Benar.
Kalau weekend biasanya ngapain?
Istirahat dan beberes.
Aku juga gitu.
Kadang cuma di rumah.
Itu juga recharge.
Setuju.
Eh, kamu suka nonton film atau series?
Lebih sering series.
Kenapa?
Lebih nyantol ceritanya.
Aku juga ngerasa gitu.
Bisa lebih kenal karakter.
Genre favorit apa?
Drama ringan.
Kalau aku komedi.
Biar nggak berat.
Iya, buat hiburan.
Kadang ketawa kecil udah cukup.
Bener.
Kamu nonton sendirian atau bareng?
Biasanya sendirian.
Aku kadang bareng temen.
Seru juga ya.
Iya, bisa diskusi.
Ngomong-ngomong, kamu suka kopi atau teh?
Kopi.
Hitam atau susu?
Kadang hitam, kadang susu.
Fleksibel ya.
Iya tergantung mood.
Kalau aku teh.
Teh hangat enak sih.
Apalagi sore hari.
Setuju.
Eh, kamu tipe orang yang teratur atau santai?
Lebih ke teratur.
Aku agak santai.
Saling melengkapi sih.
Hehe bisa jadi.
Kalau rencana biasanya detail?
Lumayan.
Aku lebih garis besar.
Yang penting jalan.
Betul.
Kamu suka nulis catatan?
Kadang.
Pakai apa?
Notes di HP.
Praktis ya.
Iya.
Aku juga begitu.
Lebih gampang.
Eh, kamu sering olahraga nggak?
Nggak rutin.
Aku juga sama.
Tapi pengin mulai.
Pelan-pelan aja.
Iya, jangan dipaksa.
Jalan pagi oke sih.
Setuju.
Kalau hujan biasanya ngapain?
Di rumah aja.
Nonton atau baca.
Aku juga.
Hujan bikin mager.
Tapi adem.
Iya enak.
Eh, kamu lebih suka chatting atau telepon?
Chatting.
Aku juga.
Lebih fleksibel.
Nggak harus langsung respon.
Betul.
Kadang bisa mikir dulu.
Iya.
Ngomong-ngomong, kamu suka masak?
Kadang.
Masak apa biasanya?
Yang simpel.
Sama.
Asal bisa dimakan.
Hehe iya.
Masak sendiri ada kepuasan.
Betul.
Kalau gagal gimana?
Anggap belajar.
Setuju.
Eh, kamu suka foto-foto?
Lumayan.
Objek apa?
Pemandangan.
Aku juga suka langit.
Langit sore bagus.
Iya apalagi senja.
Bikin tenang.
Setuju banget.
Kamu sering edit foto?
Sedikit.
Biar lebih rapi ya.
Iya.
Kalau traveling kamu tipe ribet nggak?
Nggak terlalu.
Aku juga.
Yang penting nyaman.
Betul.
Eh, kamu suka denger cerita orang?
Suka.
Kadang dapet perspektif baru.
Iya.
Bikin lebih empati.
Setuju.
Kamu orangnya gampang adaptasi?
Lumayan.
Aku juga berusaha.
Namanya juga proses.
Betul.
Yang penting mau belajar.
Iya.
Eh, kamu suka suasana ramai atau sepi?
Tergantung.
Aku lebih sering sepi.
Sepi bikin fokus.
Iya.
Tapi ramai kadang seru.
Balance ya.
Setuju.
Kalau lagi capek mental biasanya ngapain?
Diam sebentar.
Aku juga.
Kadang butuh jeda.
Betul.
Nggak apa-apa kok.
Iya.
Eh, kamu percaya istirahat itu produktif?
Percaya.
Aku juga.
Kalau dipaksa malah nggak jalan.
Setuju.
Semua ada waktunya.
Iya.
Ngobrol kayak gini juga enak ya.
Santai.
Nggak berat.
Iya ngalir aja.
Semoga hari kamu lancar ya.
Kamu juga.
Thanks udah ngobrol.
Sama-sama.
Nanti lanjut lagi.
Siap.
Aku mau booking terus ngajak temen.
Operatornya katanya eco-friendly.
Iya, mereka peduli lingkungan.
Aku mau cek paket-paketnya.
Banyak opsi sesuai budget.
Sekalian nanya diskon.
Siapa tau dapet promo.
Aku bakal share pengalaman di medsos.
Biar makin banyak yang tau.
Pasti aku rekomendasiin ke temen dan keluarga.
Review positif pasti ngaruh.
Aku catet bawa camilan.
Biar nggak drop.
Botol minum juga wajib.
Hydration itu penting di gurun.
Thanks udah sharing pengalaman.
Sama-sama! Jangan sampe nggak coba.
Aku bakal foto-foto buat tim.
Sekalian nanya rekomendasi trip selanjutnya.
Enjoy desert safari-nya, pasti nagih!`,
    automationDefaults: {
        timezone: 'Asia/Jakarta',
        windowStart: '08:00',
        windowEnd: '22:00',
        messagesPerSession: 10,
        dailyLimitPerSession: 50,
    },
};
