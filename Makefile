.PHONY: ubol.bundle

dist/cm6.bundle.ubol.min.js: node_modules src/editor.ubol.js
	npm run build

node_modules:
	npm install

ubol.bundle: dist/cm6.bundle.ubol.min.js
