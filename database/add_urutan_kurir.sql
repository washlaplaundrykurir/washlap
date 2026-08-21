-- Migration: Menambahkan kolom urutan_kurir untuk menentukan urutan pengantaran / prioritas tugas kurir
ALTER TABLE public.permintaan ADD COLUMN IF NOT EXISTS urutan_kurir INTEGER;

-- Index untuk mempercepat query pengurutan tugas kurir
CREATE INDEX IF NOT EXISTS idx_permintaan_courier_urutan ON public.permintaan(courier_id, urutan_kurir);
