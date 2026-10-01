/** @type {import('tailwindcss').Config} */
module.exports = {
  // Chỉ quét mã nguồn ứng dụng (không quét thư viện vendor)
  content: ['./public/index.html', './public/js/*.js'],
  theme: {
    extend: {
      fontFamily: { serif: ['"Times New Roman"', 'Times', 'serif'] },
    },
  },
  plugins: [],
};
