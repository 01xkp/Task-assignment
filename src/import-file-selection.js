const markdownPath = /\.md$/i

export function relativeFilePath(file) {
  return String(file?.webkitRelativePath || file?.name || '').replaceAll('\\', '/')
}

export function selectedFileKey(file) {
  return `${relativeFilePath(file)}:${Number(file?.size) || 0}:${Number(file?.lastModified) || 0}`
}

export function addSelectedFiles(currentFiles, nextFiles) {
  const seen = new Set(currentFiles.map(selectedFileKey))
  return [...currentFiles, ...Array.from(nextFiles).filter((file) => {
    const key = selectedFileKey(file)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })]
}

export function folderMarkdownFiles(files) {
  return Array.from(files).filter((file) => markdownPath.test(relativeFilePath(file)))
}
