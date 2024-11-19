const models = [
  {
    master: [
      {
        tm_barang: {
          kode_barcode: 'string',
          nama_barang: 'string',
          kode_group: 'string',
          harga_satuan: 'number',
          stok: 'number',
          kategori: 'string',
        },
      },
      {
        tm_group: {
          kode_group: 'string',
          nama_group: 'string',
        },
      },
      {
        tm_dept: {
          kode_dept: 'string',
          nama_dept: 'string',
        },
      },
    ],
  },
  {
    transaction: [
      {
        tt_jual: {
          kode_barcode: 'string',
          no_faktur_jual: 'string',
          harga: 'number',
        },
      },
    ],
  },
];
module.exports = { models };
