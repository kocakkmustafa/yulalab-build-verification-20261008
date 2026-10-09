"""Validate packaged adapter artifacts, never deployment or runtime acceptance."""
import argparse
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
GENERATOR = "@netlify/plugin-nextjs@5.16.2"
MIDDLEWARE_PATTERN = (
    r"^(?:/(_next/data/[^/]{1,}))?(?:/((?!api|_next|_vercel|.*\..*).*))"
    r"(\.json|\.rsc|\.segments/.+\.segment\.rsc)?[/#\?]?$"
)
EDGE_DIRECTORY = ".netlify/edge-functions-dist"
PROOF_PLUGIN = "./.github/netlify/artifact-proof"


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


def output_directory(directory):
    # Output roots are supplied by Netlify's lifecycle constants, never by a
    # function manifest. Check original components before resolving the path.
    directory = Path(directory)
    require(directory.is_absolute() and ".." not in directory.parts, "unsafe output directory")
    require(directory != Path(directory.anchor), "filesystem root is not an output directory")
    current = Path(directory.anchor)
    for part in directory.parts[1:]:
        current = current / part
        require(not current.is_symlink(), "symlink output directory")
    require(directory.is_dir(), "missing output directory")
    return directory


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


def validate(root, *, functions_dist=None, edge_functions_dist=None):
    root = Path(root).resolve()
    require((functions_dist is None) == (edge_functions_dist is None), "both provider output roots are required")
    provider_outputs = functions_dist is not None
    functions_directory = output_directory(functions_dist if provider_outputs else root / ".netlify/functions")
    edge_directory = output_directory(edge_functions_dist if provider_outputs else root / EDGE_DIRECTORY)

    def read(relative):
        return regular_file(root, relative).read_bytes()

    def read_json(relative):
        return json.loads(read(relative))

    config = tomllib.loads(read("netlify.toml").decode())
    require(config["build"]["command"] == "pnpm build", "build command mismatch")
    require(config["build"]["publish"] == ".next", "publish directory mismatch")
    require(config["build"]["environment"] == {"NODE_VERSION": "26.9.0", "PNPM_VERSION": "10.33.0"}, "build environment mismatch")
    require(config["plugins"] == [{"package": PROOF_PLUGIN}, {"package": "@netlify/plugin-nextjs"}], "build plugin mismatch")
    package = read_json("package.json")
    require(package["devDependencies"]["@netlify/plugin-nextjs"] == "5.16.2", "adapter version mismatch")
    require(config["headers"] == [{"for": "/portfolio-registry.json", "values": {
        "Access-Control-Allow-Origin": "https://links.yulalab.com",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "public, max-age=300, must-revalidate",
    }}], "registry headers mismatch")

    build_id = read(".next/BUILD_ID").decode().strip()
    require(len(build_id) > 5, "missing build identity")
    require(read(f".netlify/functions-internal/{HANDLER}/.next/BUILD_ID").decode().strip() == build_id, "handler build identity mismatch")
    require(read("public/portfolio-registry.json") == read(".netlify/static/portfolio-registry.json"), "registry byte mismatch")
    functions = json.loads(regular_file(functions_directory, "manifest.json").read_bytes())
    require(isinstance(functions["functions"], list) and len(functions["functions"]) == 1, "expected one server function")
    handler = functions["functions"][0]
    require(handler["name"] == HANDLER, "server function identity mismatch")
    require(handler["generator"] == GENERATOR, "server function generator mismatch")
    require(handler.get("runtimeVersion") == "nodejs24.x", "server function runtime must be explicitly nodejs24.x")
    zip_path = regular_file(functions_directory, f"{HANDLER}.zip")
    require(zip_path.stat().st_size > 0, "empty server function zip")
    require(handler["path"] == str(zip_path), "server function package path mismatch")
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "duplicate server zip member")
        require(all(safe_archive_name(name) for name in names), "unsafe server zip member path")
        require(archive.testzip() is None, "server zip CRC mismatch")
        require(archive.read(".next/BUILD_ID").decode().strip() == build_id, "server zip build identity mismatch")

    edge = json.loads(regular_file(edge_directory, "manifest.json").read_bytes())
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
        asset_path = regular_file(edge_directory, asset)
        data = asset_path.read_bytes()
        require(bool(data), "empty edge asset")
        require(hashlib.sha256(data).hexdigest() == asset[:64], "edge asset SHA-256 mismatch")
        if bundle["format"] == "eszip2":
            check_eszip(data)
        else:
            check_tar(data)
        edge_assets.append(asset_path)

    paths = [regular_file(root, relative) for relative in
             ("netlify.toml", "pnpm-lock.yaml", ".next/BUILD_ID",
              ".next/prerender-manifest.json", ".netlify/static/portfolio-registry.json")]
    paths += [regular_file(functions_directory, "manifest.json"), zip_path,
              regular_file(edge_directory, "manifest.json"), *edge_assets]
    files = []
    for artifact_path in paths:
        data = artifact_path.read_bytes()
        label = str(artifact_path.relative_to(root)) if artifact_path.is_relative_to(root) else str(artifact_path)
        files.append({"path": label, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    scope = "provider build artifact; no deployment or runtime execution" if provider_outputs else "local build artifact; no publication or provider execution"
    return {"status": "PASS", "scope": scope,
            "buildId": build_id, "functionSystem": functions["system"],
            "registryByteParity": True, "edgeFormats": sorted(formats), "files": files}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--functions-dist")
    parser.add_argument("--edge-functions-dist")
    arguments = parser.parse_args()
    try:
        result = validate(Path(__file__).resolve().parents[2],
                          functions_dist=arguments.functions_dist,
                          edge_functions_dist=arguments.edge_functions_dist)
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError, zipfile.BadZipFile, EOFError) as error:
        raise SystemExit(f"Netlify artifact contract FAIL: {error}") from error
    print(json.dumps(result, indent=2))
