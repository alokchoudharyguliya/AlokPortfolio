"""
Initial portfolio content, transcribed from the owner's profile write-up.

Only facts present in the source are included. Unknown values (exact dates,
repository links, numbers) are left empty for the owner to fill in from the
sudo dashboard rather than invented here.
"""

PROFILE = {
    "full_name": "Alok Choudhary",
    "headline": "AI Systems & Software Engineer",
    "tagline": (
        "Software engineer focused on backend systems, AI/ML and performance engineering — "
        "from application code down to the GPU."
    ),
    "roles": [
        "Software Engineer",
        "AI/ML Engineer",
        "Backend Engineer",
        "Inference & Performance Enthusiast",
        "C++ Systems Programmer",
    ],
    "journey": [
        "Building applications",
        "Backend systems",
        "ML systems",
        "LLM applications",
        "System performance",
        "Optimizing AI workloads",
        "AI systems engineering",
    ],
    "bio": (
        "CSE graduate from IIIT Senapati Manipur. I build software that is scalable, efficient, "
        "reliable and performance-conscious, and I'm moving deeper into AI systems: LLM "
        "inference, GPU computing, CUDA and model optimization."
    ),
    "about": """I started with general software development and gradually moved deeper into backend engineering, machine learning, and systems.

I enjoy understanding what happens **beneath an abstraction** — how a request moves through a backend, how data is stored and indexed, how threads communicate, how memory and CPU caches affect performance, how a neural network consumes GPU memory, and how an ML model becomes an efficient production artifact.

My current direction is **AI Systems Engineering**: combining strong software engineering fundamentals with the systems knowledge required to build and optimize modern AI workloads.

```text
model weights → memory → computation → KV cache → GPU execution
            → batching → inference runtime → latency → throughput
```
""",
    "philosophy": """Instead of asking only *"How do I use this framework?"*, I prefer asking *"What is the framework doing underneath, and what happens when the system is under load?"*

I treat performance as an engineering discipline:

1. **Measure**
2. **Identify** the bottleneck
3. **Understand** the root cause
4. **Optimize**
5. **Benchmark** again
6. **Validate** the improvement

Rather than optimizing on assumptions, I use profiling and benchmarking to find where the real bottleneck is.
""",
    "availability": "Open to Software, Backend, AI/ML Infrastructure and Inference Engineering roles",
    "is_available": True,
}

SOCIAL_LINKS = [
    ("linkedin", "LinkedIn", "https://www.linkedin.com/in/alok-choudhary-9465401ab/"),
]

FOCUS_AREAS = [
    (
        "LLM Systems",
        "How LLMs behave as computational systems, not black-box APIs.",
        "cpu",
        [
            "KV caching",
            "Batching & continuous batching",
            "Memory-efficient inference",
            "Throughput vs latency",
            "GPU memory management",
        ],
    ),
    (
        "GPU Computing",
        "CUDA specifically for AI/ML and performance engineering.",
        "gpu",
        [
            "CUDA execution model",
            "Memory hierarchy",
            "Streams & async execution",
            "Pinned memory & transfers",
            "Kernel performance",
        ],
    ),
    (
        "Model Optimization",
        "Turning trained models into efficient deployment artifacts.",
        "layers",
        [
            "Quantization (FP16 / BF16 / INT8)",
            "ONNX Runtime & TensorRT",
            "Knowledge distillation",
            "PEFT / LoRA",
        ],
    ),
    (
        "Systems",
        "The machine under the abstractions.",
        "terminal",
        ["Modern C++", "Linux & networking", "Concurrency", "CPU caches & memory", "Profiling"],
    ),
]

EXPERIENCE = [
    {
        "role": "Software Development Engineer Intern",
        "organization": "Saarathi Finance",
        "employment_type": "internship",
        "summary": (
            "Backend engineering with Django and Django REST Framework — the difference between "
            "an API that works and backend software that can be maintained, optimized, tested "
            "and evolved."
        ),
        "highlights": [
            "Built and maintained REST APIs, including APIs powering internal dashboards",
            "Designed modular backend components applying SOLID principles",
            "Optimized database access and the ORM (N+1 reduction, pagination strategies)",
            "Implemented asynchronous/background processing, URL-based file processing and CSV pipelines",
            "Automated recurring work with cron-based jobs",
            "Load-tested services with Locust and generated API documentation/schemas",
            "Worked with Flutter-side Clean Architecture and BLoC alongside backend services",
        ],
        "tags": ["Django", "DRF", "PostgreSQL", "Locust", "Flutter"],
    },
    {
        "role": "AI/ML Research Intern",
        "organization": "Smollan",
        "employment_type": "research",
        "summary": "AI/ML-oriented data ingestion and automation systems.",
        "highlights": [
            "Built FastAPI services for data ingestion pipelines",
            "Automated large-scale data collection with Selenium and multiprocessing",
            "Designed LLM-assisted workflows with Gemini, CrewAI and prompt engineering",
        ],
        "tags": ["FastAPI", "Selenium", "Gemini", "CrewAI", "Multiprocessing"],
    },
]

EDUCATION = [
    {
        "institution": "Indian Institute of Information Technology Senapati Manipur",
        "degree": "B.Tech",
        "field_of_study": "Computer Science & Engineering",
        "grade": "CPI ≈ 8.5 / 10",
        "description": (
            "Data Structures & Algorithms, Operating Systems, Computer Networks, DBMS, Computer "
            "Architecture, AI, Machine Learning, Deep Learning, Distributed Systems, Compilers."
        ),
        "highlights": ["Qualified JEE Main"],
    }
]

ACHIEVEMENTS = [
    {
        "title": "General Secretary, Technical Board",
        "kind": "leadership",
        "organization": "IIIT Senapati Manipur",
        "description": (
            "Coordinated the institute's technical community and clubs — Coding, AI/ML, Android, "
            "Web Development, VLSI and Cloud Computing."
        ),
    },
    {
        "title": "Organizer, Ahouba'24 Technical Fest",
        "kind": "leadership",
        "organization": "IIIT Senapati Manipur",
        "date": "2024-04-01",
        "description": "Helped organize the institute's technical fest, held in April 2024.",
    },
    {
        "title": "Smart India Hackathon — Finalist",
        "kind": "hackathon",
        "organization": "Smart India Hackathon",
        "description": (
            "Finalist team building a YOLOv8-based construction-site monitoring system: model "
            "training, software integration and technical presentation."
        ),
    },
    {
        "title": "Robotics Club Lead",
        "kind": "community",
        "organization": "School",
        "description": "Led the school-level Robotics Club.",
    },
]

PROJECTS = [
    {
        "title": "Model Artifact & Inference Optimization Lab",
        "category": "ai_systems",
        "status": "in_progress",
        "is_featured": True,
        "summary": (
            "Taking a trained ResNet18 from PyTorch to optimized FP32 / FP16 / INT8 artifacts and "
            "benchmarking size, memory, load time, latency and accuracy."
        ),
        "description": """Bridging machine learning and systems engineering: what happens **after** training, when a model has to become an efficient production artifact.

```text
PyTorch → TorchScript / ONNX → FP32 · FP16 · INT8 → Core ML → inference → benchmark
```

### Measured
- Model size
- RAM / VRAM usage
- Loading time
- Inference latency & throughput
- Accuracy / quality degradation
""",
        "highlights": [
            "PyTorch → ONNX / TorchScript export",
            "FP32, FP16 and INT8 variants",
            "Core ML deployment on Apple Silicon",
            "Benchmark harness for latency, memory and accuracy",
        ],
        "tags": ["PyTorch", "ONNX", "Core ML", "Quantization", "Benchmarking"],
    },
    {
        "title": "Multithreaded C++ HTTP/1.1 Server",
        "category": "systems",
        "status": "completed",
        "is_featured": True,
        "summary": (
            "A static-file HTTP/1.1 server on raw POSIX sockets with a worker thread pool — built "
            "to understand the mechanics under web frameworks."
        ),
        "description": """```text
TCP socket → connection → request framing → HTTP parsing
          → resource resolution → response serialization → socket write
```

Deliberately built without a web framework to understand what one does underneath.
""",
        "highlights": [
            "Incremental request framing (CRLF CRLF detection)",
            "RAII-based socket management, SO_REUSEADDR",
            "Worker thread pool with mutex-protected logging",
            "MIME type resolution and response serialization",
        ],
        "tags": ["C++", "POSIX Sockets", "Multithreading", "HTTP", "CMake"],
    },
    {
        "title": "Construction Site Monitoring System",
        "category": "ml",
        "status": "completed",
        "is_featured": True,
        "summary": (
            "Computer-vision platform that monitors construction-site conditions — a Smart India "
            "Hackathon finalist project."
        ),
        "description": (
            "Connected a YOLOv8 model to a real software system — Django API, Next.js frontend, "
            "PostgreSQL, JWT auth with role-based access control and an image/video pipeline — "
            "instead of leaving the model in a notebook."
        ),
        "highlights": [
            "YOLOv8 + OpenCV detection pipeline",
            "Django API with JWT and RBAC",
            "Next.js dashboard backed by PostgreSQL",
        ],
        "tags": ["YOLOv8", "OpenCV", "Django", "Next.js", "PostgreSQL"],
    },
    {
        "title": "LLM / RAG / Agent Systems",
        "category": "llm",
        "status": "in_progress",
        "summary": (
            "LLM-powered systems where the model is one component behind a tool layer, so auth, "
            "logging, rate limiting and scaling stay independent of the model."
        ),
        "description": """```text
User → Application → LLM / Agent → Tool layer → API / Service → Database
```

Experiments with retrieval, function/tool calling, API-proxy tools and database-aware tools across several model providers.
""",
        "highlights": [
            "RAG with Sentence Transformers + ChromaDB",
            "Function / tool calling, API-proxy and database-aware tools",
            "LangChain with OpenAI, Anthropic Claude and Gemini",
        ],
        "tags": ["LangChain", "RAG", "ChromaDB", "Agents", "Tool Calling"],
    },
    {
        "title": "E-Krishi",
        "category": "mobile",
        "status": "completed",
        "summary": "Agriculture app combining farming workflows with ML-based crop-disease detection.",
        "description": "Flutter app with an Express.js + MongoDB backend, real-time features over WebSockets and a TensorFlow crop-disease classifier.",
        "highlights": [
            "Flutter client",
            "Express.js REST + WebSockets",
            "TensorFlow crop-disease detection",
        ],
        "tags": ["Flutter", "Express.js", "MongoDB", "TensorFlow", "WebSockets"],
    },
    {
        "title": "E-Waste & Accident Classifiers",
        "category": "ml",
        "status": "completed",
        "summary": "Image classifiers built with transfer learning on CNN backbones.",
        "highlights": ["Transfer learning", "CNN classification", "Model evaluation"],
        "tags": ["TensorFlow", "Keras", "CNN", "Transfer Learning"],
    },
]

SKILLS = [
    ("Languages", "code", ["C++", "C", "Python", "JavaScript", "SQL", "Bash", "Dart", "PHP"]),
    (
        "Backend",
        "server",
        ["Django", "Django REST Framework", "FastAPI", "Flask", "Node.js", "Express.js"],
    ),
    (
        "AI / ML",
        "brain",
        ["PyTorch", "TensorFlow", "Keras", "Scikit-learn", "NumPy", "Pandas", "OpenCV", "YOLO"],
    ),
    (
        "LLM / GenAI",
        "sparkles",
        [
            "Transformers",
            "LangChain",
            "RAG",
            "ChromaDB",
            "Sentence Transformers",
            "PEFT / LoRA",
            "Agents & Tool Calling",
            "KV Caching",
        ],
    ),
    (
        "GPU / Inference",
        "gpu",
        ["CUDA", "Core ML", "ONNX", "ONNX Runtime", "TensorRT (concepts)", "FP16 / BF16 / INT8"],
    ),
    (
        "Systems",
        "terminal",
        [
            "Modern C++",
            "POSIX Sockets",
            "Linux",
            "Multithreading",
            "Concurrency",
            "Networking",
            "Memory Management",
        ],
    ),
    ("Databases", "database", ["PostgreSQL", "MongoDB", "PostGIS", "Redis"]),
    (
        "Infrastructure",
        "cloud",
        ["Docker", "Docker Compose", "Kubernetes", "Minikube", "Nginx", "Git", "CI/CD"],
    ),
    ("Frontend / Mobile", "layout", ["Flutter", "Next.js", "HTML", "CSS"]),
    ("Performance", "gauge", ["Locust", "k6", "wrk", "JMeter", "Profiling", "Benchmarking"]),
]
HIGHLIGHTED_SKILLS = {
    "C++",
    "Python",
    "Django",
    "PyTorch",
    "CUDA",
    "ONNX Runtime",
    "LangChain",
    "Docker",
}

SITE = {
    "site_title": "Alok Choudhary — AI Systems & Software Engineer",
    "meta_description": (
        "Software engineer focused on backend systems, AI/ML, LLM inference, GPU computing and "
        "performance engineering."
    ),
    "terminal_hostname": "guest@alok",
}

DRAFT_POST = {
    "title": "FP32 vs FP16 vs INT8 on Apple Silicon",
    "excerpt": "Draft — what actually changes when you quantize ResNet18 for Core ML.",
    "body": """> **Draft** — outline only. Edit me from sudo mode.

## Setup
## What I measured
## Results
## What surprised me
""",
    "tags": ["Core ML", "Quantization"],
}
