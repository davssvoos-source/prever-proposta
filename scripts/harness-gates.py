#!/usr/bin/env python3
"""Valida e executa o manifesto de gates do repositório (.harness/harness.yaml).

Adaptação do Pattern Harness ao Prever OS (ADR-0001): os gates rodam num sh POSIX,
que no Windows é o sh do Git for Windows — encontrado pelo PATH quando /bin/sh não existe.
Códigos de saída: 0 tudo verde · 1 gate obrigatório falhou · 2 manifesto inválido.
"""
import argparse
from pathlib import Path
import re
import shutil
import subprocess
import sys

import yaml


class ManifestError(ValueError):
    pass


class UniqueLoader(yaml.SafeLoader):
    """Rejeita chave duplicada em vez de descartar um gate em silêncio."""


def unique_mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if not isinstance(key, str) or key in result:
            raise ManifestError(f"invalid or duplicate mapping key: {key!r}")
        result[key] = loader.construct_object(value_node)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)
REFERENCE = re.compile(r"\$\{commands\.([^{}]+)\}")


def posix_shell():
    """/bin/sh onde ele existe; no Windows, o sh do Git (PATH)."""
    if Path('/bin/sh').exists():
        return '/bin/sh'
    found = shutil.which('sh')
    if found:
        return found
    raise OSError('nenhum sh POSIX encontrado — no Windows, instale o Git for Windows')


def read_gates(path):
    manifest = yaml.load(path.read_text(encoding='utf-8'), Loader=UniqueLoader)
    if not isinstance(manifest, dict) or type(manifest.get('version')) is not int or manifest['version'] != 1:
        raise ManifestError('manifest version must be 1')
    commands = manifest.get('commands')
    if commands is None:
        commands = {}
    if not isinstance(commands, dict):
        raise ManifestError('commands must be a mapping')
    for name, command in commands.items():
        if not isinstance(command, str) or not command.strip():
            raise ManifestError(f'commands.{name} must be a nonempty string')

    def resolve(command, stack=()):
        def substitute(match):
            name = match[1]
            if name not in commands:
                raise ManifestError(f'unknown command: {name}')
            if name in stack:
                raise ManifestError(f'cyclic command reference: {name}')
            return resolve(commands[name], (*stack, name))
        resolved = REFERENCE.sub(substitute, command)
        if '${commands.' in resolved:
            raise ManifestError(f'malformed command reference: {command}')
        return resolved

    for name, command in commands.items():
        resolve(command, (name,))
    gates = manifest.get('gates')
    if not isinstance(gates, list) or not gates:
        raise ManifestError('gates must be a nonempty list')
    result, names = [], set()
    for gate in gates:
        if not isinstance(gate, dict) or set(gate) != {'name', 'run', 'required'}:
            raise ManifestError('each gate needs exactly name, run and required')
        name, command, required = gate['name'], gate['run'], gate['required']
        if not isinstance(name, str) or not name.strip() or name in names:
            raise ManifestError(f'invalid or duplicate gate name: {name!r}')
        if not isinstance(command, str) or not command.strip() or type(required) is not bool:
            raise ManifestError(f'invalid run/required for gate: {name}')
        names.add(name)
        result.append((name, resolve(command), required))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, help='padrão: .harness/harness.yaml deste checkout')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    manifest = args.manifest or root / '.harness/harness.yaml'
    try:
        gates = read_gates(manifest)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f'INVALID MANIFEST: {exc}', file=sys.stderr)
        return 2
    failed = False
    for name, command, required in gates:
        print(f'RUN {name}: {command}', flush=True)
        try:
            status = subprocess.run([posix_shell(), '-c', command], cwd=root).returncode
        except OSError as exc:
            print(f'ERROR {name}: {exc}', file=sys.stderr)
            status = 127
        print(f'{"PASS" if status == 0 else "FAIL"} {name} (exit={status}, required={required})', flush=True)
        failed |= required and status != 0
    return int(failed)


if __name__ == '__main__':
    sys.exit(main())
