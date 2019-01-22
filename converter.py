#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys, os
import xml.etree.ElementTree

script_path = os.path.dirname(sys.argv[0])

print(script_path.title)

def files(path):
    for file in os.listdir(path):
        if os.path.isfile(os.path.join(path, file)):
            yield file

for source_file in files("${script_path}/source"):
    print(source_file)
