create table if not exists public.message_templates (
  code text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

insert into public.message_templates (code, content)
values (
  'ticket_copy',
  $template$Permintaan {jenis_tugas} kaka sudah kami jadwalkan dengan nomor tiket {nomor_tiket}
alamat: {alamat}
waktu: {waktu}
Nama: {nama}
Nomor HP: {nomor_hp}
catatan: {catatan}
Silahkan diinformasikan kembali jika ada informasi yang kurang tepat.

Kami informasikan juga, untuk kedepannya kaka bisa mempercepat proses antrian antar/jemput kaka dengan menginput sendiri permintaan antar/jemput ke http://mauantarjemput.washlaplaundry.com

Sesuai dengan ketentuan antar jemput kami, kami sampaikan kembali, kami akan mengusahakan semaksimal mungkin untuk antar/jemput sesuai dengan waktu yang kaka harapkan. Namun kami sampaikan mohon maaf sebelumnya jika terkadang kondisi lapangan tidak memungkinkan untuk antar/jemput sesuai waktu yang diharapkan$template$
)
on conflict (code) do nothing;
