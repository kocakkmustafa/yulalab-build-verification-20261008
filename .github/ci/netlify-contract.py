"""Validate local adapter artifacts, never publication or provider execution."""
import gzip
import hashlib
import io
import json
import re
import tarfile
import tomllib
import zipfile
from pathlib import Path, PurePosixPath

HANDLER = "___netlify-server-handler"
MIDDLEWARE = "___netlify-edge-handler-src-middleware"
GENERATOR = "@netlify/plugin-nextjs@5.15.13"
MIDDLEWARE_PATTERN = (
    r"^(?:/(_next/data/[^/]{1,}))?(?:/((?!api|_next|_vercel|.*\..*).*))"
    r"(\.json|\.rsc|\.segments/.+\.segment\.rsc)?[/#\?]?$"
)
EDGE_DIRECTORY = ".netlify/edge-functions-dist"


class ContractError(ValueError):
    pass


def require(condition, message):
    # Unlike assert, contract checks must remain active under python -O.
    if not condition:
        raise ContractError(message)


def regular_file(root, relative):
    relative = Path(relative)
    require(not relative.is_absolute() and ".." not in relative.parts, "unsafe artifact path")
    path = root
    for part in relative.parts:
        path = path / part
        require(not path.is_symlink(), f"symlink artifact path: {relative}")
    require(path.is_file(), f"missing artifact: {relative}")
    return path


def safe_archive_name(name):
    path = PurePosixPath(name)
    return bool(name) and not path.is_absolute() and ".." not in path.parts and "\\" not in name


def check_eszip(data):
    # Bounds of the pinned bundler's ESZIP_V2 sections and header checksum.
    # This is deliberately not a semantic ESZIP parser or runtime execution.
    require(data[:8] == b"ESZIP_V2", "unsupported eszip header")
    offset = 8
    for section in ("header", "sources", "source maps"):
        require(offset + 4 <= len(data), f"truncated eszip {section} length")
        length = int.from_bytes(data[offset:offset + 4], "big")
        offset += 4
        require(offset + length <= len(data), f"truncated eszip {section}")
        contents = data[offset:offset + length]
        offset += length
        if section == "header":
            require(MIDDLEWARE.encode() in contents, "eszip middleware entry missing")
            require(offset + 32 <= len(data), "truncated eszip header checksum")
            require(data[offset:offset + 32] == hashlib.sha256(contents).digest(), "eszip header checksum mismatch")
            offset += 32
        elif section == "sources":
            require(length > 0, "empty eszip sources")
    require(offset == len(data), "unexpected eszip trailing bytes")


def check_tar(data):
    # gzip.decompress consumes the trailer too, detecting truncated gzip/CRC.
    seen = set()
    regular_files = set()
    with tarfile.open(fileobj=io.BytesIO(gzip.decompress(data)), mode="r:") as archive:
        for member in archive.getmembers():
            require(safe_archive_name(member.name), "unsafe tar member path")
            name = str(PurePosixPath(member.name))
            require(name not in seen, "duplicate tar member")
            seen.add(name)
            require(member.isdir() or member.isfile(), "tar links or special members are forbidden")
            if member.isfile():
                regular_files.add(name)
                require(len(archive.extractfile(member).read()) == member.size, "truncated tar member")
    require(f"{MIDDLEWARE}.js" in regular_files, "tar middleware entry missing")


def validate(root):
    root = Path(root).resolve()

    def read(relative):
        return regular_file(root, relative).read_bytes()

    def read_json(relative):
        return json.loads(read(relative))

    config = tomllib.loads(read("netlify.toml").decode())
    require(config["build"]["command"] == "pnpm build", "build command mismatch")
    require(config["build"]["publish"] == ".next", "publish directory mismatch")
    require(config["build"]["environment"] == {"NODE_VERSION": "26.9.0", "PNPM_VERSION": "10.33.0"}, "build environment mismatch")
    require(config["plugins"] == [{"package": "@netlify/plugin-nextjs"}], "build plugin mismatch")
    package = read_json("package.json")
    require(package["devDependencies"]["@netlify/plugin-nextjs"] == "5.15.13", "adapter version mismatch")
    require(config["headers"] == [{"for": "/portfolio-registry.json", "values": {
        "Access-Control-Allow-Origin": "https://links.yulalab.com",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "public, max-age=300, must-revalidate",
    }}], "registry headers mismatch")

    build_id = read(".next/BUILD_ID").decode().strip()
    require(len(build_id) > 5, "missing build identity")
    require(read(f".netlify/functions-internal/{HANDLER}/.next/BUILD_ID").decode().strip() == build_id, "handler build identity mismatch")
    require(read("public/portfolio-registry.json") == read(".netlify/static/portfolio-registry.json"), "registry byte mismatch")
    functions = read_json(".netlify/functions/manifest.json")
    require(isinstance(functions["functions"], list) and len(functions["functions"]) == 1, "expected one server function")
    handler = functions["functions"][0]
    require(handler["name"] == HANDLER, "server function identity mismatch")
    require(handler["generator"] == GENERATOR, "server function generator mismatch")
    require(handler.get("runtimeVersion") == "nodejs24.x", "server function runtime must be explicitly nodejs24.x")
    zip_relative = f".netlify/functions/{HANDLER}.zip"
    zip_path = regular_file(root, zip_relative)
    require(zip_path.stat().st_size > 0, "empty server function zip")
    require(handler["path"] == str(zip_path), "server function package path mismatch")
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "duplicate server zip member")
        require(all(safe_archive_name(name) for name in names), "unsafe server zip member path")
        require(archive.testzip() is None, "server zip CRC mismatch")
        require(archive.read(".next/BUILD_ID").decode().strip() == build_id, "server zip build identity mismatch")

    edge = read_json(f"{EDGE_DIRECTORY}/manifest.json")
    require(edge["routes"] == [{"function": MIDDLEWARE, "pattern": MIDDLEWARE_PATTERN, "excluded_patterns": []}], "expected one middleware route")
    require(edge["post_cache_routes"] == [], "unexpected post-cache routes")
    require(edge["function_config"] == {MIDDLEWARE: {"name": "Next.js Middleware Handler", "generator": GENERATOR}}, "middleware function or generator mismatch")
    bundles = edge["bundles"]
    require(isinstance(bundles, list) and len(bundles) in (1, 2), "expected one or two edge formats")
    formats = [bundle["format"] for bundle in bundles]
    require(len(set(formats)) == len(formats), "duplicate edge format")
    require(set(formats) in ({"eszip2"}, {"eszip2", "tar"}), "unsupported edge formats")
    edge_assets = []
    for bundle in bundles:
        extension = r"eszip" if bundle["format"] == "eszip2" else r"tar\.gz"
        asset = bundle["asset"]
        require(isinstance(asset, str) and re.fullmatch(r"[0-9a-f]{64}\." + extension, asset), "unsafe edge asset path or extension")
        relative = f"{EDGE_DIRECTORY}/{asset}"
        data = read(relative)
        require(bool(data), "empty edge asset")
        require(hashlib.sha256(data).hexdigest() == asset[:64], "edge asset SHA-256 mismatch")
        if bundle["format"] == "eszip2":
            check_eszip(data)
        else:
            check_tar(data)
        edge_assets.append(relative)

    paths = ["netlify.toml", "pnpm-lock.yaml", ".next/BUILD_ID",
             ".next/prerender-manifest.json", ".netlify/static/portfolio-registry.json",
             ".netlify/functions/manifest.json", zip_relative,
             f"{EDGE_DIRECTORY}/manifest.json", *edge_assets]
    files = []
    for relative in paths:
        data = read(relative)
        files.append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return {"status": "PASS", "scope": "local build artifact; no publication or provider execution",
            "buildId": build_id, "functionSystem": functions["system"],
            "registryByteParity": True, "edgeFormats": sorted(formats), "files": files}


if __name__ == "__main__":
    try:
        result = validate(Path(__file__).resolve().parents[2])
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError, zipfile.BadZipFile, EOFError) as error:
        raise SystemExit(f"Netlify artifact contract FAIL: {error}") from error
    print(json.dumps(result, indent=2))
