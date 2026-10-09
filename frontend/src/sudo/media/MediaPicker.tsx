/**
 * Media library picker (owner only). Lists uploaded assets, uploads new ones,
 * and returns the chosen asset as a MediaRef. Used by every `media` / `gallery`
 * field in ResourceForm and by the dashboard's Media page.
 */
import { useRef, useState } from "react";

import { useAdminList, useUploadMedia } from "@/api/admin";
import { ApiError } from "@/api/client";
import type { MediaAsset, MediaRef } from "@/api/types";
import { fileSize } from "@/domain/format";
import { Button } from "@/ui/Button";
import { Drawer } from "@/ui/Drawer";
import { Icon } from "@/ui/Icon";
import { useToast } from "@/ui/Toast";

import styles from "./Media.module.css";

export function toMediaRef(a: MediaAsset): MediaRef {
  return { id: a.id, url: a.url, alt: a.alt_text || a.title, kind: a.kind, width: a.width, height: a.height };
}

export function UploadButton({
  onUploaded,
  accept,
  label = "Upload file",
}: {
  onUploaded?: (asset: MediaAsset) => void;
  accept?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const toast = useToast();

  const onFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      try {
        const asset = await upload.mutateAsync({ file, title: file.name.replace(/\.[^.]+$/, "") });
        onUploaded?.(asset);
        toast(`Uploaded ${file.name}`, "success");
      } catch (err) {
        const msg = err instanceof ApiError ? Object.values(err.fields).flat()[0] ?? err.message : "Upload failed";
        toast(msg, "error");
      }
    }
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <input ref={input} type="file" hidden accept={accept} multiple onChange={(e) => onFiles(e.target.files)} />
      <Button icon="upload" loading={upload.isPending} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  );
}

export function MediaGrid({
  kind,
  onPick,
  selectedId,
}: {
  kind?: "image" | "document";
  onPick: (asset: MediaAsset) => void;
  selectedId?: number | null;
}) {
  const [search, setSearch] = useState("");
  const list = useAdminList<MediaAsset>("media", { kind, search: search || undefined, page_size: 200 });

  return (
    <div className={styles.picker}>
      <label className={styles.search}>
        <Icon name="search" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files" />
      </label>
      {list.isLoading ? <p className={styles.muted}>Loading files…</p> : null}
      {list.data?.length === 0 ? (
        <p className={styles.muted}>No files yet. Upload one to use it here.</p>
      ) : null}
      <ul className={styles.grid}>
        {list.data?.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              className={styles.tile}
              aria-pressed={selectedId === asset.id}
              onClick={() => onPick(asset)}
            >
              {asset.kind === "image" ? (
                <img src={asset.url} alt={asset.alt_text} loading="lazy" />
              ) : (
                <span className={styles.fileIcon}>
                  <Icon name="file" size={28} />
                </span>
              )}
              <span className={styles.tileName}>{asset.title || asset.original_name}</span>
              <span className={styles.tileMeta}>{fileSize(asset.size)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: MediaRef) => void;
  kind?: "image" | "document";
}) {
  const choose = (asset: MediaAsset) => {
    onSelect(toMediaRef(asset));
    onClose();
  };
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={kind === "document" ? "Choose a document" : "Choose an image"}
      size="lg"
      footer={
        <UploadButton
          accept={kind === "image" ? "image/*" : kind === "document" ? ".pdf,.md,.txt" : undefined}
          onUploaded={choose}
          label="Upload and use"
        />
      }
    >
      <MediaGrid kind={kind} onPick={choose} />
    </Drawer>
  );
}
