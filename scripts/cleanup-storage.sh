#!/bin/bash

# 清理 Node 服务端文件存储的脚本
# 用法: ./scripts/cleanup-storage.sh [选项]

set -e

# 默认数据目录（可通过环境变量 DATA_DIR 覆盖）
DATA_DIR="${DATA_DIR:-data}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示使用说明
show_help() {
  cat << EOF
清理 Node 服务端文件存储

用法: $0 [选项]

选项:
  --builds-only      只清理构建缓存 (data/builds/)
  --apps-only        只清理静态应用 (data/apps/)
  --projects-only    只清理项目数据文件 (data/projects.json)
  --all              清理所有数据（构建缓存 + 静态应用 + 项目数据）
  --dry-run          预览将要删除的文件，但不实际删除
  --help             显示此帮助信息

环境变量:
  DATA_DIR           数据目录路径（默认: data）

示例:
  # 预览将要删除的构建缓存
  $0 --builds-only --dry-run

  # 清理所有构建缓存
  $0 --builds-only

  # 清理所有数据（危险操作！）
  $0 --all

EOF
}

# 计算目录大小
get_size() {
  if [ -d "$1" ]; then
    du -sh "$1" 2>/dev/null | cut -f1
  else
    echo "0"
  fi
}

# 清理构建缓存
clean_builds() {
  local dry_run=$1
  local builds_dir="$DATA_DIR/builds"
  
  if [ ! -d "$builds_dir" ]; then
    echo -e "${YELLOW}构建目录不存在: $builds_dir${NC}"
    return
  fi

  local size=$(get_size "$builds_dir")
  local count=$(find "$builds_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  
  echo -e "${YELLOW}构建缓存目录: $builds_dir${NC}"
  echo -e "  目录数量: $count"
  echo -e "  总大小: $size"
  
  if [ "$dry_run" = "true" ]; then
    echo -e "${GREEN}[预览模式] 将删除以下目录:${NC}"
    find "$builds_dir" -mindepth 1 -maxdepth 1 -type d | while read dir; do
      echo "  - $dir ($(get_size "$dir"))"
    done
  else
    echo -e "${RED}正在删除构建缓存...${NC}"
    rm -rf "$builds_dir"/*
    echo -e "${GREEN}✓ 构建缓存已清理${NC}"
  fi
}

# 清理静态应用
clean_apps() {
  local dry_run=$1
  local apps_dir="$DATA_DIR/apps"
  
  if [ ! -d "$apps_dir" ]; then
    echo -e "${YELLOW}应用目录不存在: $apps_dir${NC}"
    return
  fi

  local size=$(get_size "$apps_dir")
  local count=$(find "$apps_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  
  echo -e "${YELLOW}静态应用目录: $apps_dir${NC}"
  echo -e "  目录数量: $count"
  echo -e "  总大小: $size"
  
  if [ "$dry_run" = "true" ]; then
    echo -e "${GREEN}[预览模式] 将删除以下目录:${NC}"
    find "$apps_dir" -mindepth 1 -maxdepth 1 -type d | while read dir; do
      echo "  - $dir ($(get_size "$dir"))"
    done
  else
    echo -e "${RED}正在删除静态应用...${NC}"
    rm -rf "$apps_dir"/*
    echo -e "${GREEN}✓ 静态应用已清理${NC}"
  fi
}

# 清理项目数据文件
clean_projects() {
  local dry_run=$1
  local projects_file="$DATA_DIR/projects.json"
  
  if [ ! -f "$projects_file" ]; then
    echo -e "${YELLOW}项目数据文件不存在: $projects_file${NC}"
    return
  fi

  local size=$(get_size "$projects_file")
  
  echo -e "${YELLOW}项目数据文件: $projects_file${NC}"
  echo -e "  文件大小: $size"
  
  if [ "$dry_run" = "true" ]; then
    echo -e "${GREEN}[预览模式] 将删除文件: $projects_file${NC}"
  else
    echo -e "${RED}正在删除项目数据文件...${NC}"
    rm -f "$projects_file"
    echo -e "${GREEN}✓ 项目数据文件已清理${NC}"
  fi
}

# 主函数
main() {
  local builds_only=false
  local apps_only=false
  local projects_only=false
  local all=false
  local dry_run=false

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      --builds-only)
        builds_only=true
        shift
        ;;
      --apps-only)
        apps_only=true
        shift
        ;;
      --projects-only)
        projects_only=true
        shift
        ;;
      --all)
        all=true
        shift
        ;;
      --dry-run)
        dry_run=true
        shift
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        echo -e "${RED}未知选项: $1${NC}"
        show_help
        exit 1
        ;;
    esac
  done

  # 如果没有指定任何选项，显示帮助
  if [ "$builds_only" = false ] && [ "$apps_only" = false ] && [ "$projects_only" = false ] && [ "$all" = false ]; then
    echo -e "${YELLOW}请指定要清理的内容，或使用 --help 查看帮助${NC}"
    echo ""
    show_help
    exit 1
  fi

  # 检查数据目录是否存在
  if [ ! -d "$DATA_DIR" ]; then
    echo -e "${RED}错误: 数据目录不存在: $DATA_DIR${NC}"
    exit 1
  fi

  echo -e "${GREEN}=== Node 服务端文件存储清理工具 ===${NC}"
  echo -e "数据目录: ${YELLOW}$DATA_DIR${NC}"
  
  if [ "$dry_run" = "true" ]; then
    echo -e "${GREEN}[预览模式] 不会实际删除文件${NC}"
  else
    echo -e "${RED}[警告] 将实际删除文件！${NC}"
    # 如果设置了 SKIP_CONFIRM 环境变量，跳过确认（用于 CI/CD）
    if [ "${SKIP_CONFIRM:-}" != "true" ]; then
      read -p "确认继续? (yes/no): " confirm
      if [ "$confirm" != "yes" ]; then
        echo "已取消"
        exit 0
      fi
    else
      echo -e "${YELLOW}[自动模式] 跳过确认，直接执行清理${NC}"
    fi
  fi

  echo ""

  # 执行清理
  if [ "$all" = true ]; then
    clean_builds "$dry_run"
    echo ""
    clean_apps "$dry_run"
    echo ""
    clean_projects "$dry_run"
  else
    if [ "$builds_only" = true ]; then
      clean_builds "$dry_run"
    fi
    
    if [ "$apps_only" = true ]; then
      clean_apps "$dry_run"
    fi
    
    if [ "$projects_only" = true ]; then
      clean_projects "$dry_run"
    fi
  fi

  echo ""
  echo -e "${GREEN}=== 清理完成 ===${NC}"
}

main "$@"

