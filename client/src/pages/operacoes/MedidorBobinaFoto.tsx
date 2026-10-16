import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Check, RotateCcw } from "lucide-react";

type Ponto = { x: number; y: number };

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
const etapas = [
  "Marque as duas pontas do lado maior do cartão",
  "Marque as duas bordas do diâmetro externo da bobina",
  "Marque as duas bordas do furo interno da bobina",
];

export default function MedidorBobinaFoto({
  onUsar,
}: {
  onUsar: (medidas: { externoMm: number; internoMm: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imagemRef = useRef<HTMLImageElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [temImagem, setTemImagem] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [erroCamera, setErroCamera] = useState("");

  const resultado = useMemo(() => {
    if (pontos.length < 6) return null;
    const cartaoPx = distancia(pontos[0], pontos[1]);
    if (cartaoPx <= 0) return null;
    const mmPorPixel = 85.6 / cartaoPx;
    return {
      externoMm: distancia(pontos[2], pontos[3]) * mmPorPixel,
      internoMm: distancia(pontos[4], pontos[5]) * mmPorPixel,
    };
  }, [pontos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const imagem = imagemRef.current;
    if (!canvas || !imagem || !temImagem) return;
    const escala = Math.min(1, 1200 / imagem.naturalWidth);
    const largura = Math.round(imagem.naturalWidth * escala);
    const altura = Math.round(imagem.naturalHeight * escala);
    if (canvas.width !== largura || canvas.height !== altura) {
      canvas.width = largura;
      canvas.height = altura;
    }
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.clearRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const cores = ["#2563eb", "#f59e0b", "#16a34a"];
    pontos.forEach((ponto, indice) => {
      const grupo = Math.floor(indice / 2);
      contexto.fillStyle = cores[grupo];
      contexto.strokeStyle = "white";
      contexto.lineWidth = 3;
      contexto.beginPath();
      contexto.arc(ponto.x, ponto.y, 8, 0, Math.PI * 2);
      contexto.fill();
      contexto.stroke();
      if (indice % 2 === 1) {
        contexto.strokeStyle = cores[grupo];
        contexto.lineWidth = 5;
        contexto.beginPath();
        contexto.moveTo(pontos[indice - 1].x, pontos[indice - 1].y);
        contexto.lineTo(ponto.x, ponto.y);
        contexto.stroke();
      }
    });
  }, [pontos, temImagem]);

  useEffect(() => {
    if (cameraAberta && videoRef.current && streamRef.current)
      videoRef.current.srcObject = streamRef.current;
  }, [cameraAberta]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
    },
    []
  );

  const carregar = (arquivo: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(arquivo);
    urlRef.current = url;
    const imagem = new Image();
    imagem.onload = () => {
      imagemRef.current = imagem;
      setPontos([]);
      setTemImagem(true);
    };
    imagem.src = url;
  };

  const abrirCamera = async () => {
    setErroCamera("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Este navegador não oferece acesso à câmera nesta página."
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAberta(true);
    } catch (erro) {
      setErroCamera(
        erro instanceof Error
          ? erro.message
          : "Não foi possível abrir a câmera."
      );
    }
  };

  const tirarFoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const contexto = canvas.getContext("2d");
    if (!contexto) return;
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (blob) carregar(blob);
      },
      "image/jpeg",
      0.92
    );
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraAberta(false);
  };

  const marcar = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!temImagem || pontos.length >= 6) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    setPontos(atuais => [
      ...atuais,
      {
        x: ((event.clientX - rect.left) * canvas.width) / rect.width,
        y: ((event.clientY - rect.top) * canvas.height) / rect.height,
      },
    ]);
  };

  const etapa = Math.min(2, Math.floor(pontos.length / 2));
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <div className="font-medium">Medição assistida pela foto</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Coloque um cartão padrão deitado no mesmo plano da face da bobina e
          fotografe de frente. A foto é processada somente neste aparelho.
        </p>
      </div>
      {!temImagem && !cameraAberta && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => void abrirCamera()}
        >
          <Camera className="h-5 w-5" /> Abrir câmera do aparelho
        </Button>
      )}
      {erroCamera && (
        <p role="alert" className="text-sm text-destructive">
          {erroCamera}
        </p>
      )}
      {cameraAberta && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="max-h-[55vh] w-full rounded-md border bg-black"
          />
          <div className="flex gap-2">
            <Button type="button" className="flex-1 gap-2" onClick={tirarFoto}>
              <Camera className="h-4 w-4" /> Tirar foto
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                streamRef.current?.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setCameraAberta(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {temImagem && (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            setTemImagem(false);
            setPontos([]);
            void abrirCamera();
          }}
        >
          <Camera className="h-4 w-4" /> Tirar outra foto
        </Button>
      )}
      {temImagem && (
        <>
          <div className="rounded-md bg-background p-2 text-center text-sm font-medium">
            {pontos.length < 6 ? etapas[etapa] : "Medições concluídas"} (
            {pontos.length}/6 pontos)
          </div>
          <canvas
            ref={canvasRef}
            onClick={marcar}
            className="max-h-[55vh] w-full touch-manipulation cursor-crosshair rounded-md border object-contain"
          />
          {resultado && (
            <div className="grid grid-cols-2 gap-2 rounded-md bg-background p-3 text-sm">
              <div>
                <span className="block text-xs text-muted-foreground">
                  Diâmetro externo
                </span>
                <b>{resultado.externoMm.toFixed(1)} mm</b>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">
                  Diâmetro interno
                </span>
                <b>{resultado.internoMm.toFixed(1)} mm</b>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 min-[400px]:flex-row">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setPontos([])}
            >
              <RotateCcw className="h-4 w-4" /> Refazer marcações
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={
                !resultado || resultado.externoMm <= resultado.internoMm
              }
              onClick={() => resultado && onUsar(resultado)}
            >
              <Check className="h-4 w-4" /> Usar medidas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
