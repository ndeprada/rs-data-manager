import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Play, Image as ImageIcon, Loader, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const extractVideoId = (url) => {
  if (!url) return null;
  // YouTube: watch?v=, youtu.be/, /shorts/, /live/
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const patterns = [
      /[?&]v=([^&\n?#]+)/,
      /youtu\.be\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return { platform: "youtube", id: match[1] };
    }
    return null;
  }
  if (url.includes("vimeo.com")) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? { platform: "vimeo", id: match[1] } : null;
  }
  if (url.includes("dailymotion.com") || url.includes("dai.ly")) {
    const match = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([^_?&\n#]+)/);
    return match ? { platform: "dailymotion", id: match[1] } : null;
  }
  return null;
};

export default function MatchMediaSection({ eventId, event }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [playingLink, setPlayingLink] = useState(null); // link being played in modal

  const mediaFiles = event?.media_files || [];
  const videoLinks = event?.video_links || [];

  const updateEventMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      alert("Solo se permiten videos e imágenes");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
      setPreviewType(isVideo ? "video" : "image");
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const isVideo = selectedFile.type.startsWith("video/");
      const fileUrl = await base44.integrations.Core.UploadFile({
        file: selectedFile,
      });

      const newMedia = {
        file_url: fileUrl.file_url,
        file_name: selectedFile.name,
        file_type: isVideo ? "video" : "image",
        description: description,
        uploaded_at: new Date().toISOString(),
      };

      const updatedMedia = [...mediaFiles, newMedia];
      await updateEventMutation.mutateAsync({
        media_files: updatedMedia,
      });

      setSelectedFile(null);
      setDescription("");
      setPreviewUrl(null);
      setPreviewType(null);
      fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error al subir archivo:", error);
      alert("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMedia = (index) => {
    const updatedMedia = mediaFiles.filter((_, i) => i !== index);
    updateEventMutation.mutate({ media_files: updatedMedia });
  };

  const handleAddVideoLink = async () => {
    if (!videoUrl.trim()) {
      alert("Ingresa una URL de video");
      return;
    }

    const videoData = extractVideoId(videoUrl);
    if (!videoData) {
      alert("URL no válida. Usa YouTube, Vimeo o Dailymotion");
      return;
    }

    const newLink = {
      url: videoUrl,
      platform: videoData.platform,
      title: videoTitle || `Video ${videoData.platform}`,
      added_at: new Date().toISOString()
    };

    const updatedLinks = [...videoLinks, newLink];
    await updateEventMutation.mutateAsync({
      video_links: updatedLinks
    });

    setVideoUrl("");
    setVideoTitle("");
    setAddingLink(false);
  };

  const handleDeleteVideoLink = (index) => {
    const updatedLinks = videoLinks.filter((_, i) => i !== index);
    updateEventMutation.mutate({ video_links: updatedLinks });
  };

  const getVideoEmbedUrl = (link) => {
    const videoData = extractVideoId(link.url);
    if (!videoData) return null;
    switch (videoData.platform) {
      case "youtube":
        return `https://www.youtube.com/embed/${videoData.id}?autoplay=1&rel=0`;
      case "vimeo":
        return `https://player.vimeo.com/video/${videoData.id}?autoplay=1`;
      case "dailymotion":
        return `https://www.dailymotion.com/embed/video/${videoData.id}?autoplay=1`;
      default:
        return null;
    }
  };

  const getVideoThumbnail = (link) => {
    const videoData = extractVideoId(link.url);
    if (!videoData) return null;
    if (videoData.platform === "youtube") {
      return `https://img.youtube.com/vi/${videoData.id}/hqdefault.jpg`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files">Archivos</TabsTrigger>
          <TabsTrigger value="links">Videos externos</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-6">
      {/* Upload Area */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-center font-semibold text-gray-900">Subir multimedia</h3>
          <p className="text-center text-sm text-gray-500">
            Adjunta videos de jugadas clave o imágenes de la pizarra táctica
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full border-gray-300"
          >
            Seleccionar archivo
          </Button>
        </div>
      </div>

      {/* Preview y Descripción */}
      {selectedFile && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="bg-gray-100 rounded-lg overflow-hidden max-h-64">
            {previewType === "video" ? (
              <video src={previewUrl} className="w-full h-full object-cover" controls />
            ) : (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Descripción (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Gol de ventaja - minuto 23"
              className="border-gray-200"
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setDescription("");
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 text-white"
              style={{ background: "var(--granate)" }}
            >
              {uploading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Subir
                </>
              )}
            </Button>
          </div>
        </div>
      )}

        {/* Media Grid */}
        {mediaFiles.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              Archivos adjuntos ({mediaFiles.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mediaFiles.map((media, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative bg-gray-100 h-40 overflow-hidden group">
                    {media.file_type === "video" ? (
                      <>
                        <video
                          src={media.file_url}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={media.file_url}
                          alt={media.description}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white" />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 truncate">
                          {media.file_name}
                        </p>
                        {media.description && (
                          <p className="text-sm text-gray-900 mt-1">{media.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMedia(index)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      {media.uploaded_at
                        ? format(new Date(media.uploaded_at), "dd/MM/yyyy HH:mm")
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mediaFiles.length === 0 && !selectedFile && (
          <p className="text-center text-gray-400 text-sm py-8">
            No hay archivos adjuntos. Sube tu primer video o imagen.
          </p>
        )}
      </TabsContent>

        <TabsContent value="links" className="space-y-6">
          {/* Agregar enlace de video */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8">
            <div className="space-y-4">
              <div className="flex justify-center">
                <LinkIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-center font-semibold text-gray-900">Agregar video externo</h3>
              <p className="text-center text-sm text-gray-500">
                YouTube, Vimeo, Dailymotion
              </p>

              <Button
                onClick={() => setAddingLink(!addingLink)}
                variant="outline"
                className="w-full border-gray-300"
              >
                {addingLink ? "Cancelar" : "+ Agregar enlace"}
              </Button>
            </div>
          </div>

          {/* Formulario agregar enlace */}
          {addingLink && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">URL del video *</label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Título (opcional)</label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ej: Gol increíble minuto 45"
                  className="border-gray-200"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setVideoUrl("");
                    setVideoTitle("");
                    setAddingLink(false);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddVideoLink}
                  className="flex-1 text-white"
                  style={{ background: "var(--granate)" }}
                >
                  <LinkIcon className="w-4 h-4 mr-2" /> Agregar
                </Button>
              </div>
            </div>
          )}

          {/* Videos externos */}
          {videoLinks.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                Videos agregados ({videoLinks.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {videoLinks.map((link, index) => {
                   const thumbnail = getVideoThumbnail(link);
                   const embedUrl = getVideoEmbedUrl(link);
                   return (
                     <div
                       key={index}
                       className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow"
                     >
                       {/* Thumbnail clicable */}
                       <div
                         className="relative bg-black h-44 cursor-pointer group"
                         onClick={() => embedUrl && setPlayingLink(link)}
                       >
                         {thumbnail ? (
                           <img src={thumbnail} alt={link.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-70 transition-opacity" />
                         ) : (
                           <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                             <Play className="w-10 h-10 text-white/40" />
                           </div>
                         )}
                         <div className="absolute inset-0 flex items-center justify-center">
                           <div className="w-14 h-14 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center transition-colors">
                             <Play className="w-6 h-6 text-white ml-1" />
                           </div>
                         </div>
                       </div>

                       {/* Info */}
                       <div className="p-3 space-y-1">
                         <div className="flex items-start justify-between gap-2">
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded capitalize text-[10px] font-bold uppercase">
                                 {link.platform}
                               </span>
                               <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate">
                                 Abrir en {link.platform}
                               </a>
                             </div>
                           </div>
                           <button
                             onClick={() => handleDeleteVideoLink(index)}
                             className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}

          {videoLinks.length === 0 && !addingLink && (
            <p className="text-center text-gray-400 text-sm py-8">
              No hay videos externos. Agrega tu primer enlace.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Video player modal */}
      <Dialog open={!!playingLink} onOpenChange={() => setPlayingLink(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-0">
          <DialogHeader className="absolute top-2 right-2 z-10">
            <DialogTitle className="sr-only">{playingLink?.title}</DialogTitle>
          </DialogHeader>
          {playingLink && (
            <div className="w-full" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={getVideoEmbedUrl(playingLink)}
                className="w-full h-full"
                title={playingLink.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}