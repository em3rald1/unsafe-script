```c
int i = 5;
int main() {
    int x = 6;
}
```

Codes:

GLOBAL: ["MOV R2 SP", "LSTR R2 -1 5"]
.USmain_int(): ["PSH R2", "MOV R2 SP", "LSTR R2 -1 6"]

Compiled:

BITS 32
MINREGS 8
MINHEAP 0xffff
MINSTACK 0xff

MOV R2 SP
SUB SP SP 1
LSTR R2 -1 5
CAL .USmain_int()
ADD SP SP 1
MOV SP R2
HLT

.USmain_int()
    PSH R2
    MOV R2 SP
    SUB SP SP 1
    LSTR R2 -1 6
    ADD SP SP 1
    MOV SP R2
    POP R2
    RET