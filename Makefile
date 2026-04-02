.PHONY: build build-web build-server web server clean

# 全量构建：先前端后后端
build: build-web build-server

# 构建前端（输出到 web/）
build-web:
	cd frontend && npm install && npm run build

# 构建后端（输出到 bin/）
build-server:
	@mkdir -p bin
	go build -o bin/lifelog .

# 启动前端开发模式
web:
	cd frontend && npm run dev

# 启动后端开发模式
server:
	go run .

# 清空所有构建产物
clean:
	rm -rf bin
	rm -rf web/assets web/index.html
	rm -rf frontend/node_modules
