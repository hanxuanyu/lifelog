.PHONY: build build-web build-server web server clean

# 全量构建：先前端后后端（当前平台）
build: build-web build-server

# 跨平台构建：前端 + 6 个平台二进制
build-all:
	bash scripts/build.sh

# 构建前端（输出到 web/）
build-web:
	cd frontend && npm install && npm run build

# 构建后端（输出到 bin/，当前平台）
build-server:
	@mkdir -p bin
	CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/lifelog .

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
