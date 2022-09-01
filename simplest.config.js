export default {
  input: 'site',
  template: 'template.html',
  passThrough: ['FAQ/keep_intact.*'],
  htmlExtensions: [".html", ".htm", ".php"],
  devServerOptions: { ui: false, server: undefined, proxy: "127.0.0.1:3001" }
}