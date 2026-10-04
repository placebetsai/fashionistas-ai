# fashionistas-tryon — Leffa virtual try-on as an HTTP service.
#
# GPU build (the intended target). CPU works too, but a 7.2 GB fp32 checkpoint
# plus two UNets needs ~12 GB RAM and runs at ~5 min/step — fine for a
# correctness test, not for serving.
#
#   docker build -t fashionistas-tryon services/leffa
#   docker run --gpus all -p 8090:8090 \
#     -e LEFFA_MODEL=hd -e LEFFA_CKPTS=/models \
#     -v /srv/leffa-ckpts:/models fashionistas-tryon
#
# Checkpoints are NOT baked into the image (8.2 GB for hd alone). Mount them.

FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    LEFFA_REPO=/opt/Leffa \
    LEFFA_CKPTS=/models \
    LEFFA_MODEL=hd \
    LEFFA_PORT=8090

# git: clone Leffa; libgl1/libglib2.0-0: opencv; curl: healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

RUN git clone --depth 1 https://github.com/franciszzj/Leffa.git /opt/Leffa

WORKDIR /opt/Leffa

# Leffa's own stack first (torch already present in the base image), then ours.
COPY requirements.txt /tmp/service-requirements.txt
RUN pip install -r requirements.txt \
    && pip install -r /tmp/service-requirements.txt

COPY app.py /opt/Leffa/service_app.py

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --start-period=600s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8090/health || exit 1

# start-period is long on purpose: loading the checkpoint is minutes.
CMD ["sh", "-c", "python service_app.py"]
